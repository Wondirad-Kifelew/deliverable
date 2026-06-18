import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import pool from './db';
import cors from 'cors';
 
const app = express();
app.use(cors());
app.use(express.json());

const RESERVATION_TTL_MS = 60 * 1000; //1 minute

async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL!');
    console.log(result.rows[0]);
  } catch (err) {
    console.error('Connection failed:', err);
  }
}

testConnection();
// GET all products
app.get('/products', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM products');
  res.json(rows);
});

// POST reserve a product
app.post('/products/:id/reserve', async (req, res) => {
  const productId = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE products
       SET available_quantity = available_quantity - 1
       WHERE id = $1 AND available_quantity > 0
       RETURNING id`,
      [productId],
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Sold out' });
    }

    const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

    const { rows } = await client.query(
      `INSERT INTO reservations (product_id, status, expires_at)
       VALUES ($1, 'PENDING', $2) RETURNING *`,
      [productId, expiresAt],
    );

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    client.release();
  }
});

// POST checkout a reservation
app.post('/reservations/:id/checkout', async (req, res) => {
  const reservationId = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
// check if the reservation is there,  pending or not expired if not rollback
    const { rows } = await client.query(
      'SELECT * FROM reservations WHERE id = $1 FOR UPDATE',
      [reservationId],
    );
    const reservation = rows[0];

    if (!reservation) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Reservation is ${reservation.status}` });
    }

    if (new Date(reservation.expires_at) < new Date()) {
      // expired - release inventory back
      await client.query(`UPDATE reservations SET status = 'EXPIRED' WHERE id = $1`, [reservationId]);
      await client.query(`UPDATE products SET available_quantity = available_quantity + 1 WHERE id = $1`, [reservation.product_id]);
      await client.query('COMMIT');
      return res.status(410).json({ error: 'Reservation expired' });
    }
// res.. exists, not expired and status is pending then pay (assume the client paid here)
    await client.query(`UPDATE reservations SET status = 'COMPLETED' WHERE id = $1`, [reservationId]);
    await client.query('COMMIT');

    res.json({ message: 'Checkout complete', reservationId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  } finally {
    client.release();
  }
});
// GET reservation status (for frontend polling/countdown)
app.get('/reservations/:id', async (req, res) => {
  const reservationId = req.params.id;
  const client = await pool.connect();
  
  // const { rows } = await pool.query('SELECT * FROM reservations WHERE id = $1', [req.params.id]);
  // const reservation = rows[0];
   
  
  try {
    
    const { rows } = await client.query(
      'SELECT * FROM reservations WHERE id = $1',
      [reservationId]
    );
    const reservation = rows[0];

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  
  if (reservation.status === 'PENDING' && new Date(reservation.expires_at) < new Date()) {
      await client.query('BEGIN');

      await client.query(
        `UPDATE reservations SET status = 'EXPIRED' WHERE id = $1`, 
        [reservationId]);
      await client.query(
        `UPDATE products SET available_quantity = available_quantity + 1 WHERE id = $1`,
        [reservation.product_id]
      );

      await client.query('COMMIT');

    reservation.status = 'EXPIRED';
    
  }

  res.json(reservation);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Something went wrong' });
  }finally{
  client.release();
}
}
);
// Background job: this catches if there are abandoned reservations so they wont lock
// the stock forever.It checks expiry of curr resrvations every 10 seconds
setInterval(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: expired } = await client.query(
      `SELECT id, product_id FROM reservations
       WHERE status = 'PENDING' AND expires_at < now()
       FOR UPDATE`,
    );

    for (const r of expired) {
      await client.query(`UPDATE reservations SET status = 'EXPIRED' WHERE id = $1`, [r.id]);
      await client.query(`UPDATE products SET available_quantity = available_quantity + 1 WHERE id = $1`, [r.product_id]);
    }

    await client.query('COMMIT');
    if (expired.length) console.log(`Expired ${expired.length} reservation(s)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Expiry job failed:', err);
  } finally {
    client.release();
  }
}, 10_000);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
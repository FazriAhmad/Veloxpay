import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { toComponentDTO } from '../mappers.js';
import { writeAuditLog } from '../auditLog.js';
import { wrapAsync } from '../wrapAsync.js';

export const componentsRouter = Router();
componentsRouter.use(requireAuth);

componentsRouter.get('/', wrapAsync(async (req, res) => {
  const result = await pool.query('SELECT * FROM salary_components WHERE company_id = $1 ORDER BY created_at', [
    req.auth.companyId,
  ]);
  res.json(result.rows.map(toComponentDTO));
}));

componentsRouter.post('/', requireRole('admin'), wrapAsync(async (req, res) => {
  const { name, type, amountType, value, description } = req.body || {};
  if (!name || !type || !amountType || value === undefined) {
    return res.status(400).json({ error: 'name, type, amountType, dan value wajib diisi.' });
  }
  if (amountType === 'percentage' && Number(value) > 100) {
    return res.status(400).json({ error: 'Nilai persentase tidak boleh lebih dari 100.' });
  }

  const id = `COMP-${randomUUID().slice(0, 6).toUpperCase()}`;
  const result = await pool.query(
    `INSERT INTO salary_components (id, company_id, name, type, calc_method, value, description, is_editable)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true) RETURNING *`,
    [id, req.auth.companyId, name, type, amountType, value, description || '']
  );
  await writeAuditLog(req.auth, 'ADD_COMPONENT', `Menambahkan komponen gaji baru "${name}" (${type})`);
  res.status(201).json(toComponentDTO(result.rows[0]));
}));

componentsRouter.put('/:id', requireRole('admin'), wrapAsync(async (req, res) => {
  const { name, type, amountType, value, description } = req.body || {};
  const result = await pool.query(
    `UPDATE salary_components SET name=$1, type=$2, calc_method=$3, value=$4, description=$5
     WHERE id=$6 AND company_id=$7 RETURNING *`,
    [name, type, amountType, value, description || '', req.params.id, req.auth.companyId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Komponen tidak ditemukan.' });
  await writeAuditLog(req.auth, 'UPDATE_COMPONENT', `Memperbarui detail komponen gaji "${name}"`);
  res.json(toComponentDTO(result.rows[0]));
}));

componentsRouter.delete('/:id', requireRole('admin'), wrapAsync(async (req, res) => {
  const result = await pool.query('DELETE FROM salary_components WHERE id=$1 AND company_id=$2 RETURNING name', [
    req.params.id,
    req.auth.companyId,
  ]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Komponen tidak ditemukan.' });
  await writeAuditLog(req.auth, 'DELETE_COMPONENT', `Menghapus komponen gaji "${result.rows[0].name}"`);
  res.status(204).end();
}));

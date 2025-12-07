const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Инициализация базы данных
const db = new sqlite3.Database('./plans.db', (err) => {
    if (err) {
        console.error('Ошибка подключения к базе данных:', err);
    } else {
        console.log('Подключено к базе данных SQLite');
        initDatabase();
    }
});

// Создание таблицы, если она не существует
function initDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
        deadline DATE NOT NULL,
        author TEXT NOT NULL,
        completed BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Ошибка создания таблицы:', err);
        } else {
            console.log('Таблица plans готова к использованию');
        }
    });
}

// API endpoints

// Получить все планы
app.get('/api/plans', (req, res) => {
    db.all('SELECT * FROM plans ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Получить один план по ID
app.get('/api/plans/:id', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM plans WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'План не найден' });
            return;
        }
        res.json(row);
    });
});

// Создать новый план
app.post('/api/plans', (req, res) => {
    const { title, description, priority, deadline, author } = req.body;
    
    if (!title || !deadline || !author) {
        res.status(400).json({ error: 'Заполните обязательные поля' });
        return;
    }
    
    const sql = `INSERT INTO plans (title, description, priority, deadline, author) 
                 VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [title, description || '', priority || 'medium', deadline, author], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            id: this.lastID,
            title,
            description: description || '',
            priority: priority || 'medium',
            deadline,
            author,
            completed: false,
            created_at: new Date().toISOString()
        });
    });
});

// Обновить план
app.put('/api/plans/:id', (req, res) => {
    const id = req.params.id;
    const { title, description, priority, deadline, author, completed } = req.body;
    
    const sql = `UPDATE plans 
                 SET title = ?, description = ?, priority = ?, deadline = ?, author = ?, completed = ?
                 WHERE id = ?`;
    
    db.run(sql, [title, description || '', priority || 'medium', deadline, author, completed ? 1 : 0, id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'План не найден' });
            return;
        }
        res.json({ message: 'План обновлен', changes: this.changes });
    });
});

// Удалить план
app.delete('/api/plans/:id', (req, res) => {
    const id = req.params.id;
    
    db.run('DELETE FROM plans WHERE id = ?', [id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'План не найден' });
            return;
        }
        res.json({ message: 'План удален', changes: this.changes });
    });
});

// Тоггл статуса выполнения
app.patch('/api/plans/:id/toggle', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT completed FROM plans WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'План не найден' });
            return;
        }
        
        const newStatus = !row.completed;
        db.run('UPDATE plans SET completed = ? WHERE id = ?', [newStatus ? 1 : 0, id], function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ completed: newStatus, changes: this.changes });
        });
    });
});

// Получить статистику
app.get('/api/stats', (req, res) => {
    db.all(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority
        FROM plans
    `, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows[0]);
    });
});

// Обслуживание клиентского HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
    console.log('Данные сохраняются в базе SQLite и не пропадут после перезагрузки');
});
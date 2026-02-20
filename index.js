const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = 3018;

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

// Serve your HTML form
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle form submission
app.post('/register', (req, res) => {
    const { regd_no, name, email } = req.body;
    console.log('Registration data:', { regd_no, name, email });
    res.send('Registration successful!');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
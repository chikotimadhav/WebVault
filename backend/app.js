const express = require('express');
const cors = require('cors');
const websiteRoutes = require('./routes/websites');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/websites', websiteRoutes);

app.get('/', (req, res) => {
    res.json({ status: 'WebVault API running' });
});

module.exports = app;

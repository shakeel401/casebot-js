const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Static file serving
app.use('/archive', express.static(path.join(__dirname, 'archive')));
app.use('/archived', express.static(path.join(__dirname, 'archived')));
app.use('/ai system', express.static(path.join(__dirname, 'ai system')));
app.use('/netlify', express.static(path.join(__dirname, 'netlify')));
app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname)));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(port, () => {
    console.log(`Development server running at http://localhost:${port}`);
});
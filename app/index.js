// index.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req,res) => res.send(`Hello from UMT DevSecOps Workshop! Host: ${process.env.HOSTNAME || 'local'}`));
app.get('/health', (req,res) => res.status(200).json({status:'ok'}));
app.get('/error', (req,res) => { // useful to trigger alerts
  res.status(500).send('forced error for demo');
});

app.listen(port, () => console.log(`listening on ${port}`));

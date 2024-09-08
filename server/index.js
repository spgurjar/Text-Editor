require('dotenv').config();
const express = require('express');
const mongoose = require("mongoose");
const http = require('http');
const { Server } = require("socket.io");
const Document = require("./doc");
const cors = require("cors")

const app = express();
const server = http.createServer(app);

// const allowedOrigins = process.env.CORS_ORIGINS.split(',');
app.get('/', (req,res)=>{
  res.send('hello')
})

const io = new Server(server, {cors:{
origin: '*',
methods: ['GET', 'POST']
}
}
);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("Could not connect to MongoDB:", err));

const defaultValue = "";

io.on("connection", socket => {
  socket.on("get-document", async documentId => {
    const document = await findOrCreateDocument(documentId);
    socket.join(documentId);
    socket.emit("load-document", document.data);

    socket.on("send-changes", delta => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async data => {
      await Document.findByIdAndUpdate(documentId, { data });
    });
  });
});

async function findOrCreateDocument(id) {
  if (id == null) return;

  const document = await Document.findById(id);
  if (document) return document;
  return await Document.create({ _id: id, data: defaultValue });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
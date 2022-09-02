import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
// import dotenv from "dotenv"; TODO: Conectar o dotenv
// dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = "5000";

const mongoClient = new MongoClient("mongodb://localhost:27017");

let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("test");
});

const participantSchema = joi.object({
  name: joi.string().required(),
});

/* Participants Routes */

app.post("/participants", (req, res) => {
  const { name } = req.body;

  const validation = participantSchema.validate({ name });

  if (validation.error) {
    const loginerror = validation.error.details[0].message;
    res.status(422).send(loginerror);
    return;
  }

  db.collection("participants").insertOne({
    name: name,
  });
  res.sendStatus(201);
});

app.listen(port, () => console.log("Server listening on 5000"));

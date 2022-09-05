import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import { participantSchema, messageSchema } from "./Schema.js";
import dotenv from "dotenv";
import res from "express/lib/response.js";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = "5000";

const mongoClient = new MongoClient(process.env.MONGO_URI);

let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("uol_api");
});

async function isUser(username) {
  const loggedUser = await db
    .collection("participants")
    .findOne({ name: username });
  return loggedUser;
}

/* Participants Routes */

app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const validation = participantSchema.validate({ name });

  if (validation.error) {
    const loginError = validation.error.details[0].message;
    res.status(422).send(loginError);
    return;
  }
  const loggedUser = await isUser(name);
  if (loggedUser) {
    res.sendStatus(409);
    return;
  } else {
    try {
      await db
        .collection("participants")
        .insertOne({ name: name, lastStatus: Date.now() });
      await db.collection("messages").insertOne({
        from: name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs(Date.now()).format("HH:mm:ss"),
      });
      res.sendStatus(201);
    } catch (err) {
      res.status(500).send(err);
    }
  }
});

app.get("/participants", async (req, res) => {
  try {
    const allParticipants = await db
      .collection("participants")
      .find()
      .toArray();
    res.send(allParticipants);
  } catch (err) {
    res.status(500).send(err);
  }
});

/* Messages Routes */

app.post("/messages", async (req, res) => {
  const from = req.headers.user;
  const validation = messageSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const messageError = validation.error.details.map(
      (detail) => detail.message
    );
    res.status(422).send(messageError);
    return;
  }
  const loggedUser = await isUser(from);
  if (!loggedUser) {
    res.status(422).send("Faça login novamente para continuar batendo papo");
    return;
  }

  try {
    await db.collection("messages").insertOne({
      from,
      ...req.body,
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err);
  }
});

app.get("/messages", async (req, res) => {
  const limit = Number(req.query.limit);
  const username = req.headers.user;

  try {
    const messages = await db
      .collection("messages")
      .find({
        $or: [
          { type: "status" },
          { type: "message" },
          { to: username },
          { from: username },
        ],
      })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();

    res.send(messages.reverse());
  } catch (err) {
    res.status(500).send(err);
    console.log(err);
  }
});

app.delete("/messages/:id", async (req, res) => {
  const user = req.headers.user;
  const { id } = req.params;

  try {
    const deleteMessage = await db
      .collection("messages")
      .findOne({ _id: new ObjectId(id) });

    if (!deleteMessage) {
      res.sendStatus(404);
      return;
    }

    if (deleteMessage.from !== user) {
      res.sendStatus(401);
      return;
    }
    await db.collection("messages").deleteOne({ _id: new ObjectId(id) });

    res.sendStatus(204);
  } catch (error) {
    res.status(500).send(error);
  }
});

/*Status Route */

app.post("/status", async (req, res) => {
  const username = req.headers.user;
  console.log("Teste");

  try {
    const { modifiedCount } = await db
      .collection("participants")
      .updateOne({ name: username }, { $set: { lastStatus: Date.now() } });
    if (modifiedCount === 0) {
      res.sendStatus(404);
      return;
    }
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err);
  }
});

/*Remove inactive Users */

setInterval(async () => {
  const removeUser = await db
    .collection("participants")
    .find({ lastStatus: { $lt: Date.now() - 10000 } })
    .toArray();

  await db
    .collection("participants")
    .deleteMany({ lastStatus: { $lt: Date.now() - 10000 } });

  removeUser.forEach(async (user) => {
    await db.collection("messages").insertOne({
      from: user.name,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
  });
}, 15000);

app.listen(port, () => console.log("Listening on port 5000!"));

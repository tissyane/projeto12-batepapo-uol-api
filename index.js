import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dayjs from "dayjs";
import { participantSchema, messageSchema } from "./utils/Schema.js";
import dotenv from "dotenv";
import sanitizer from "./utils/Sanitizer.js";
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
    return res.status(422).send(loginError);
  }
  const loggedUser = await isUser(name);
  if (loggedUser) {
    return res.sendStatus(409);
  } else {
    try {
      await db
        .collection("participants")
        .insertOne({ name: sanitizer(name), lastStatus: Date.now() });
      await db.collection("messages").insertOne({
        from: sanitizer(name),
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
  const { to, text, type } = req.body;
  const validation = messageSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const messageError = validation.error.details.map(
      (detail) => detail.message
    );
    return res.status(422).send(messageError);
  }
  const loggedUser = await isUser(from);
  if (!loggedUser) {
    return res
      .status(422)
      .send("Faça login novamente para continuar batendo papo");
  }

  try {
    await db.collection("messages").insertOne({
      from,
      to: sanitizer(to),
      text: sanitizer(text),
      type,
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
      return res.sendStatus(404);
    }

    if (deleteMessage.from !== user) {
      return res.sendStatus(401);
    }
    await db.collection("messages").deleteOne({ _id: new ObjectId(id) });

    res.sendStatus(204);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.put("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const user = req.headers.user;
  const { to, text, type } = req.body;

  const validation = messageSchema.validate(req.body, { abortEarly: false });
  if (validation.error) {
    const messageError = validation.error.details.map(
      (detail) => detail.message
    );
    return res.status(422).send(messageError);
  }
  const loggedUser = await isUser(user);
  if (!loggedUser) {
    return res.status(422).send("Faça login novamente");
  }

  try {
    const updateMessage = await db
      .collection("messages")
      .findOne({ _id: new ObjectId(id) });
    if (!updateMessage) {
      return res.sendStatus(404);
    }
    if (updateMessage.from !== user) {
      return res.sendStatus(401);
    }

    await db.collection("messages").updateOne(
      { $and: [{ _id: new ObjectId(id) }, { from: user }] },
      {
        $set: {
          to: sanitizer(to),
          text: sanitizer(text),
          type,
        },
      }
    );
    res.sendStatus(201);
  } catch (error) {
    res.status(500).send(error);
  }
});

/*Status Route */

app.post("/status", async (req, res) => {
  const username = req.headers.user;

  try {
    const { modifiedCount } = await db
      .collection("participants")
      .updateOne({ name: username }, { $set: { lastStatus: Date.now() } });
    if (modifiedCount === 0) {
      return res.sendStatus(404);
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

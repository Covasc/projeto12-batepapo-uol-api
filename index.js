import { MongoClient } from "mongodb";
import express from "express";
import cors from "cors";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";


const server = express();
server.use(express.json());
server.use(cors());
dotenv.config();

const PORT = process.env.PORT;

//BD
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("batePapoUOL");
});

//API

setInterval(isActive, 15000);

server.post("/participants", async (request, response) => {

    const userName = request.body;

    //validation
    const nameSchema = joi.object({
        name: joi.string().required()
    });
    const validation = nameSchema.validate(userName);

    if (validation.error) {
        console.log(validation.error.details);
        response.sendStatus(422);
        return;
    };

    try {
        //IsInUse? validation
        const userRegistred = await db.collection('participants').findOne({ name: userName.name });

        if (userRegistred) {
            return response.sendStatus(409);
        };

        await db.collection('participants').insertOne({
            name: userName.name, 
            lastStatus: Date.now()
        });
        await db.collection('messages').insertOne({
            from: userName.name, 
            to: 'Todos', text: 'entra na sala...', 
            type: 'status', 
            time: dayjs(Date.now()).format('HH:mm:ss')
        })
        response.sendStatus(201);
    } catch (error) {
        console.log(error);
        response.sendStatus(500);
    };
});

server.get('/participants', async (request, response) => {
    try {
        const participantsList = await db.collection('participants').find().toArray();
        response.send(participantsList);
    } catch (error) {
        console.log(error);
        response.sendStatus(500);
    };
});

server.post('/messages', async (request, response) => {

    const userMessage = request.body;
    userMessage.from = request.headers.user;

    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required(),
        from: joi.string().required()
    });

    const validation = messageSchema.validate(userMessage);

    if (validation.error) {
        console.log(validation.error.details);
        response.sendStatus(422);
        return;
    };

    try {
        //IsActive? validation
        const userRegistred = await db.collection('participants').findOne({ name: userMessage.from });

        if (!userRegistred) {
            return response.sendStatus(422);
        };

        await db.collection('messages').insertOne({
            ...userMessage, 
            time: dayjs(Date.now()).format('HH:mm:ss')
        });
        response.sendStatus(201);
    } catch (error) {
        console.log(error);
        response.sendStatus(500);
    };
})

server.get('/messages', async (request, response) => {

    const user = request.headers.user;
    const limit = parseInt(request.query.limit);

    try {
        const messageList = await db.collection('messages').find().toArray();
        const userMessageList = messageList.filter(message => message.type === 'message' || message.to === user || message.from === user );
        let userMessageListLimited = [];
        
        if (!limit) {
            response.send(userMessageList);
            return;
        } else { 
            userMessageListLimited = userMessageList.slice(-limit);
            response.send(userMessageListLimited);
        }
    } catch (error) {
        console.log(error);
        response.sendStatus(500);
    }
});

server.post('/status' , async (request, response) => {
    
    const user = request.headers.user;

    try {
        const validate = await db.collection('participants').findOne({name: user});
        if (!validate) {
            response.sendStatus(404);
            return;
        };

        await db.collection('participants').updateOne({
            name: user
        },
        {
            $set: {
                name: user,
                lastStatus: Date.now()
            }
        });
        response.sendStatus(200);
    } catch (error) {
        console.log(error);
        response.sendStatus(500);
    };
});

async function isActive () {
    try {
        const userList = await db.collection('participants').find().toArray();

        for ( const user of userList ) {
            if (Date.now() - user.lastStatus > 10) {
                await db.collection('participants').deleteOne({ name: user.name });
                await db.collection('messages').insertOne({
                    from: user.name, 
                    to: 'Todos', text: 'sai da sala...', 
                    type: 'status', 
                    time: dayjs(Date.now()).format('HH:mm:ss')
                })
            };    
        };
    } catch (error) {
        console.log(error);
        response.sendStatus(500);
    };    
}

server.listen(PORT, () => {
    console.log("Server running")
});
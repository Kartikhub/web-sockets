import { WebSocketServer, WebSocket } from 'ws';
import { createClient } from 'redis';
 

const wss = new WebSocketServer({ port: 8080 });

const publisherClient = createClient();
const subscriberClient = createClient();

startConnect(); 

const usersMap: Map<number, {
    ws: WebSocket,
    rooms: string[]
}> = new Map();

setInterval(() => {
    console.log(usersMap);
}, 5000);


wss.on('connection', function connection(userSocket) {
    userSocket.on('error', console.error);
    const id = Math.random();

    userSocket.on('message', async function message(data) {
        const parsedData = JSON.parse(data as unknown as string);
        if (parsedData.type === "SUBSCRIBE") {
            let user = usersMap.get(id);
            if(!user) {
                usersMap.set(id, {
                    ws: userSocket,
                    rooms: [parsedData.roomId]
                }
                );
            } else {
                if(!user.rooms.includes(parsedData.roomId)) {
                    user.rooms.push(parsedData.roomId);
                }
                usersMap.set(id, user);
            }
            await subscriberClient.subscribe(parsedData.roomId, (message) => {
                    if(user && user.rooms.includes(parsedData.roomId)) {
                        user.ws.send(message);
                    }
            });
        }
        if (parsedData.type === "UNSUBSCRIBE") {
            const roomId = parsedData.roomId;
            let user = usersMap.get(id);
            if(user && user.rooms.includes(roomId)) {
                user.rooms = user.rooms.filter(x => x !== parsedData.roomId);
            }
            subscriberClient.unsubscribe(parsedData.roomId, () => {console.log("Unsubscribed")});
        }
        if (parsedData.type === "SENDMESSAGE") {
            const message = parsedData.message;
            const roomId = parsedData.roomId;
            await publisherClient.publish(roomId, message);
        }
    });
});



async function startConnect() {
    await publisherClient.connect();
    await subscriberClient.connect();
}
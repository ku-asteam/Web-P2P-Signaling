
"use strict";

const { group } = require('console');
const e = require('express');

const SERVER_PORT = 8080;

const fs = require('fs');
const options = {
    ca: fs.readFileSync('**************'),
    key: fs.readFileSync('**************'),
    cert: fs.readFileSync('**************')

    // key: fs.readFileSync('**************', 'utf8'),
    // cert: fs.readFileSync('**************', 'utf8'),
    // passphrase: '**************'
}

const app = require('express')();
const bodyParser = require('body-parser');
const cors = require('cors');

const server = require('https').createServer(options, app);
const io = require('socket.io')(server);

let rooms = {};
let groups = {};

app.get('/', function (req, res) {
    res.sendText("hello, world!");
});

// connection event handler
io.on('connection', function (socket) {
    console.log("WebSocket client requests connection, socket id: " + socket.id);

    socket.on('message', function (message) {
        console.log('Room: ', message.room, ', Client said: ', message.message);
        socket.broadcast.to(message.room).emit('message', message.message);
    });

    socket.on('join websocket room', function (userId) {
        console.log('Received request to create or join room ' + userId);

        let clientsInRoom = io.sockets.adapter.rooms[userId];
        let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
        console.log('Room for ' + userId + ' now has ' + numClients + ' client(s)');

        if (numClients === 0) {
            console.log('Client ID ' + socket.id + ' created room ' + userId);

            socket.join(userId);
            io.to(socket.id).emit('created'); 

            //{roomId: userId, clients: [socketId, socketId...]}
            let room = {
                userId: userId,
                clients: []
            };

            let client = {
                name: socket.id,
                groupId: null, // hosted group Id, null if not create any group
                hostedGroupId: null
            };

            room.clients.push(client);
            rooms[room.userId] = room; //key: room.userId, value: room

        } else if (numClients > 0) {
            console.log('Client ID ' + socket.id + ' joined room ' + userId);
            socket.join(userId);

            //If group already created for this user, send group info
            let group = null;
            for (let i = 0; i < groups.length; i++) {
                if (groups[i].userId === userId) {
                    //found my group
                    group = groups[i];
                }
            }

            io.to(socket.id).emit('joined', group); 
    
            let client = {
                name: socket.id,
                groupId: null,
                hostedGroupId: group? group.groupId: null
            };
            rooms[userId].clients.push(client);
        } 
        // else { // max two clients
        //     socket.emit('full', roomId);
        // }
    });

    socket.on('disconnect', function (reason) {
        // event occurs when chrome extension reloaded
        //clients global object { name: socket.id, user: userId, group: groupId }
        // rooms[] groups[]

        console.log(`Peer or server disconnected. Reason: ${reason}.`);
        socket.broadcast.emit('bye');
    });

    socket.on('bye', function (room) {
        console.log(`Peer said bye on room ${room}.`);
    });

    //DUI group management
    socket.on('create DUI group', function (userId) {
        //generate new DUI group and update groups state
        let group = {
            userId: userId,
            host: socket.id,
            groupId: getRandomGroupId(),
            members: []
        }
        
        let member = {
            userId: userId,
            name: socket.id,
            type: "Host"
        }
        group.members.push(member);
        groups[group.groupId] = group; //key: group.groupId, value: group        
        
        // update client state
        rooms[userId].clients.forEach(function (client, index) {
            if (client.name === socket.id) // client is a host of group
                rooms[userId].clients[index].groupId = group.groupId;

            rooms[userId].clients[index].hostedGroupId = group.groupId;
        });
        
        console.log("DUI group created: " + group.groupId);

        //inform to all client that new group is created
        rooms[userId].clients.forEach(function (client, index) {
            if ((!client.groupId) || client.name === group.host) {
                io.to(client.name).emit('DUI group created', group); 
            } 
        });
        
    });

    socket.on('join DUI group', function (userId, groupId) {
        //peer1, peer2, ... (assignment)
        console.log("request message from peer (DUI join)");

        if (groups[groupId]) {
            console.log("peer is joined to DUI group");
            let member = {
                userId: userId,
                name: socket.id,
                type: "Peer"
            }
            groups[groupId].members.push(member);

            //inform that new peer is joined to DUI group
            io.to(groups[groupId].host).emit('DUI group joined', groups[groupId]); // to host
            io.to(socket.id).emit('DUI group joined', groups[groupId]); // to new peer

            // update client state
            rooms[userId].clients.forEach(function (client, index) {
                if (client.name === socket.id)
                    rooms[userId].clients[index].groupId = groupId;
            });

        } else { // No group identified
            console.log("No group with given Id");
            io.to(socket.id).emit('invalid DUI group id'); // to new peer
        }

    });

    socket.on('destroy DUI group', function (userId, groupId) {
        // message from Host
        console.log("Host wants to destroy the DUI group");

        let members = groups[groupId].members;
        groups[groupId] = null;

        // Clients that have same user Id
        rooms[userId].clients.forEach(function (client, index) { 
            // inform that group is destroyed
            if (client.groupId && client.groupId != groupId) { // joined other user's group
                io.to(client.name).emit('DUI group destroyed', groups[client.groupId], true); 
            } else {
                io.to(client.name).emit('DUI group destroyed', null, false);
            }

            // update client state
            if (client.groupId === groupId) { // destroyed group members
                rooms[userId].clients[index].groupId = null;
            }

            rooms[userId].clients[index].hostedGroupId = null;
        });
        
        // Members that have different user Id
        for (let member of members) { 
            if (member.userId != userId) {
                rooms[member.userId].clients.forEach(function (client, index) {
                    if (member.name === client.name) { // destroyed group members
                        if (client.hostedGroupId) {
                            io.to(member.name).emit('DUI group destroyed', groups[client.hostedGroupId], false);
                        } else {
                            io.to(member.name).emit('DUI group destroyed', null, false);
                        }

                        rooms[member.userId].clients[index].groupId = null;
                    }
                });

                // let hasHostedGroup = false;
                // for (let [id, group] of Object.entries(groups)) {
                //     if (group) {
                //         if (group.userId === member.userId) {
                //             io.to(member.name).emit('DUI group destroyed', group, false); 
                //             hasHostedGroup = true;
                //         }
                //     }
                // }

                // if(!hasHostedGroup) io.to(member.name).emit('DUI group destroyed', null, false);
            }
        }
    });

    socket.on('exit DUI group', function (userId, groupId) {
        // message from Peer
        console.log("request message from peer (DUI exit)");
    
        // remove target peer from member array
        let targetIndex = groups[groupId].members.findIndex((member) => { // return index of member array which refers exited peer
            if (member.name === socket.id) return true;
        });

        if (targetIndex > -1) {
            groups[groupId].members.splice(targetIndex, 1);
        }

        // inform
        io.to(groups[groupId].host).emit('DUI peer exited', groups[groupId]); // to host

        if (groups[groupId].userId != userId) { // exit from other user's group
            let hasHostedGroup = false;
            for (let [id, group] of Object.entries(groups)) {
                if (group) {
                    if (group.userId === userId) {
                        io.to(socket.id).emit('DUI peer exited', group); // to exited peer
                        hasHostedGroup = true;
                    }
                }
            }
            if (!hasHostedGroup) io.to(socket.id).emit('DUI peer exited', null);
        } else { // exit from my group
            io.to(socket.id).emit('DUI peer exited', groups[groupId]); // to exited peer
        }

        // update client state
        rooms[userId].clients.forEach(function (client, index) {
            if (client.name === socket.id)
                rooms[userId].clients[index].groupId = null;
        });
    });

    socket.on('setup DUI', function (userId, groupId) {
        console.log("request for setup DUI with given group");
    
        // Check DUI group

        // Generate DUI configuration (S1, S2)

        // Send response to members to start P2P connections establishment
        io.to(socket.id).emit('start P2P connection');

    });

    // To setup WebRTC peer to peer connections
    socket.on('signaling', function (destination, data) {
        io.to(destination).emit('signaling', socket.id, data);
    });


});

function getRandomGroupId() {
    return Math.floor(100000 + Math.random() * 900000);
}

server.listen(SERVER_PORT, function () {
    console.log("Socket IO server is listening on port " + SERVER_PORT);
});

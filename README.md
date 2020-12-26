# Web-P2P-Signaling
A signaling server for browsers' peer to peer communcation

## Introduction
Web-P2P-Signaling is a part of an implementation of aSTEAM Project (Next-Generation Information Computing Development Program through the National Research Foundation of Korea (NRF) funded by the Ministry of Science and ICT; https://asteam.korea.ac.kr)'s device-to-device event analysis system. Web-P2P-Signaling is a Node.js-based signal server for Web-P2P-Data (https://github.com/ku-asteam/Web-P2P-Data) library.

## Requirements
* sudo apt install nodejs npm
* npm install socket.io (>= 3.0.0)
* npm install express (>= 4.17.1)
* npm install https

## Instructions

### Port
```
const SERVER_PORT = 8080;
```
Set a port number for this server

### Options for HTTPS
```
const options = {
    ca: fs.readFileSync('**************'),
    key: fs.readFileSync('**************'),
    cert: fs.readFileSync('**************')

    // key: fs.readFileSync('**************', 'utf8'),
    // cert: fs.readFileSync('**************', 'utf8'),
    // passphrase: '**************'
}
```
I recommend you to install the 'letsencrypt' package.

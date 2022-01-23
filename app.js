const { Client } = require("whatsapp-web.js");
const express = require("express");
const { body, validationResult } = require("express-validator");
const socketIO = require("socket.io");
const qrcode = require("qrcode");
const http = require("http");
const { phoneNumberFormatter } = require("./helpers/formatter");
const fs = require("fs");

// Instantiate service
const port = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(
    express.urlencoded({
        extended: true
    })
);

// Function to write log log of last device status
function writeLog(content, socket) {
    try {
        if (socket != null) {
            socket.emit("status", readLog());
        }

        fs.writeFileSync("./log.txt", content);
    } catch (err) {
        console.error(err);
    }
}

// Function to read log of last device status
function readLog() {
    try {
        return fs.readFileSync("./log.txt", "utf8");
    } catch (err) {
        console.error(err);
    }
}

// Whatsapp client initialization
const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process",
            "--disable-gpu"
        ]
    },
    clientId: "note-10"
});

try {
    client.initialize();
} catch (error) {
    writeLog(error);
}

client.on("message", msg => {
    if (msg.body == "!ping") {
        msg.reply("pong");
    } else if (msg.body == "good morning") {
        msg.reply("selamat pagi");
    }
});

// Socket IO to communicate realtime with browser
io.on("connection", function (socket) {
    socket.emit("message", "Connecting...");
    socket.emit("status", readLog());

    client.on("qr", qr => {
        console.log("QR RECEIVED", qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit("qr", url);
            socket.emit("message", "QR Code received, scan please!");

            writeLog("QR RECEIVED", socket);
        });
    });

    client.on("ready", () => {
        socket.emit("ready", "Whatsapp is ready!");
        socket.emit("message", "Whatsapp is ready!");

        writeLog("READY", socket);
    });

    client.on("authenticated", () => {
        socket.emit("authenticated", "Whatsapp is authenticated!");
        socket.emit("message", "Whatsapp is authenticated!");

        writeLog("AUTHENTICATED", socket);
    });

    client.on("auth_failure", message => {
        socket.emit("message", `Auth failure, ${message} restarting...`);

        writeLog(`AUTH FAILURE ${message}`, socket);
    });

    client.on("disconnected", reason => {
        socket.emit("message", "Whatsapp is disconnected!" + reason);

        client.destroy();
        client.initialize();

        writeLog("DISCONNECTED", socket);
    });
});

// Home index
app.get("/", (req, res) => {
    res.sendFile("index.html", {
        root: __dirname
    });
});

// Send message
app.post(
    "/send-message",
    [body("number").notEmpty(), body("message").notEmpty()],
    async (req, res) => {
        // Validate parameter is not empty
        const errors = validationResult(req).formatWith(({ msg }) => {
            return msg;
        });

        if (!errors.isEmpty()) {
            return res.status(422).json({
                status: false,
                message: errors.mapped()
            });
        }

        const message = req.body.message;

        // Validate number is correct and registered in whatsapp
        const number = phoneNumberFormatter(req.body.number);
        const isRegisteredNumber = await client.isRegisteredUser(number);
        if (!isRegisteredNumber) {
            return res.status(400).json({
                status: false,
                message: "The number is not registered"
            });
        }

        client
            .sendMessage(number, message)
            .then(response => {
                res.status(200).json({
                    status: true,
                    response: response
                });
            })
            .catch(err => {
                res.status(500).json({
                    status: false,
                    response: err
                });
            });
    }
);

server.listen(port, function () {
    console.log("App running on *: " + port);
});

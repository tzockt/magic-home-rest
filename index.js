const { Control, Discovery } = require('magic-home');
const express = require("express");
const bodyParser = require('body-parser');

const PORT = process.env.PORT || 3000;

let devices = [];

// Functions

const scanDevices = () => {
    console.log('Scanning for devices ...');
    Discovery.scan(1000).then(d => {
        devices = d;
        const s = d.length == 1 ? "" : "s";
        console.log(`Found ${d.length} device${s}`)
        devices.forEach(element => {
            console.log(element);
        });
    })
}

const hexToRgb = (hex) => {

    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const newHex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(newHex);

    return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        }
        : null;
}

// Scan devices and set interval to scan every minute

scanDevices();
setInterval(scanDevices, 60000);

// Express

const app = express();

// Middleware

app.use(bodyParser.json());
app.use((err, req, res, next) => {

    if (err) {

        res.status(500).send('Something went wrong!');

    } else {

        // Website you wish to allow to connect
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Request methods you wish to allow
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

        // Request headers you wish to allow
        res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

        // Set to true if you need the website to include cookies in the requests sent
        // to the API (e.g. in case you use sessions)
        res.setHeader('Access-Control-Allow-Credentials', true);

        // Pass to next layer of middleware
        next();
    }
});

// Endpoints

// Color endpoint
app.post("/api/color", (req, res) => {

    try {

        const color = req.body.color;
        const brightness = req.body.brightness ? req.body.brightness : 100;
        const id = req.body.id;
        const address = req.body.address;

        if (typeof color === 'undefined') {
            res.status('500').send('Color must be defined');
            return;
        }

        let r = 255, g = 255, b = 255;

        if (typeof color === 'number') {

            const c = req.body.color
            r = Math.floor(c / (256 * 256));
            g = Math.floor(c / 256) % 256;
            b = c % 256;

        } else if (typeof color === 'string') {

            const rgb = hexToRgb(color);

            if (rgb == null) throw "Couldn't parse color string"

            r = rgb.r;
            g = rgb.g;
            b = rgb.b;

        } else {

            res.status('500').send('Color must be of type string (hex) or number (decimal)');
            return;
        }

        // Filter devices and loop over them to set color
        const localDevices = devices.filter(device => (
            (
                id === undefined ||
                device.id === id
            ) &&
            (
                address === undefined ||
                device.address === address)
        ));

        const promises = [];

        localDevices.forEach(device => {
            const control = new Control(device.address, {
                wait_for_reply: false
            });
            promises.push(control.setColorWithBrightness(r, g, b, brightness));
        })

        Promise.all(promises)
            .then(() => res.sendStatus('200'))
            .catch(err => res.status(500).send(err));

    } catch (e) {

        res.status(500).send(e);
    }

});

// Power endpoint
app.post("/api/power", (req, res) => {

    try {

        const id = req.body.id;
        const address = req.body.address;
        const power = req.body.power;

        if (typeof power === 'undefined') {

            res.status('500').send('Power state must be defined');
            return;
        }

        if (typeof power !== 'boolean') {

            res.status('500').send('Power value must be boolean');
            return;
        }

        // Filter devices and loop over them to set power
        const localDevices = devices.filter(device => (
            (
                id === undefined ||
                device.id === id
            ) &&
            (
                address === undefined ||
                device.address === address
            )
        ));

        const promises = [];

        localDevices.forEach(device => {
            const control = new Control(device.address, {
                wait_for_reply: false,
            })
            promises.push(control.setPower(power));
        })

        Promise.all(promises)
            .then(() => res.sendStatus('200'))
            .catch(err => res.status(500).send(err));

    } catch (e) {

        res.status(500).send(e);
    }
});

// Devices endpoint
app.get("/api/devices", (req, res) => {
    res.json(devices);
})

// Device endpoint
app.get("/api/device/:id", (req, res) => {

    const id = req.params.id;

    if (typeof id === 'undefined') {

        res.status(500).send('Id must be defined!');
        return;
    }

    const device = devices.find(element => element.id === id);

    if (device === undefined) {

        res.status(500).send(`No device with id ${id} was found`);
        return;
    }

    new Control(device.address)
        .queryState()
        .then(state => res.json(state))
        .catch(err => res.status(500).send(err));
})

// Start listening for requests

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

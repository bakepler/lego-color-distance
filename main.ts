let initialized = false
let attempts = 0
let lastKeepAlive = 0

function checksum(data: number[]): number {
    let cs = 0xFF
    for (let i = 0; i < data.length; i++) {
        cs ^= data[i]
    }
    return cs
}

function sendLPF2(cmd: number[]) {
    let buf = pins.createBuffer(cmd.length + 1)
    for (let i = 0; i < cmd.length; i++) {
        buf.setUint8(i, cmd[i])
    }
    buf.setUint8(cmd.length, checksum(cmd))
    serial.writeBuffer(buf)
}

// === Wake pulse ===
// LPF2 expects a short LOW pulse on RX to wake UART mode
function wakeSensor() {
    serial.writeLine("Sending wake pulse")
    pins.digitalWritePin(DigitalPin.P1, 0)
    basic.pause(50)
    pins.digitalWritePin(DigitalPin.P1, 1)
    basic.pause(50)
    serial.writeLine("Wake pulse sent")
}

// === Send initialization sequence at 2400 ===
function initLPF2_2400() {
    serial.writeLine("Redirecting to 2400 baud")
    serial.redirect(SerialPin.P1, SerialPin.P2, BaudRate.BaudRate2400)
    serial.writeLine("Sending init command [0x41, 0x01]")
    sendLPF2([0x41, 0x01]) // select distance mode
    basic.pause(100)
    serial.writeLine("Init command sent")
}

// === Switch to high-speed 115200 ===
function switchBaud115200() {
    serial.writeLine("Switching to 115200 baud")
    serial.redirect(SerialPin.P1, SerialPin.P2, BaudRate.BaudRate115200)
    basic.pause(100)
    serial.writeLine("Baud switched")
}

// Button A to reset initialization
input.onButtonPressed(Button.A, function () {
    serial.writeLine("Reset button pressed - resetting initialization")
    initialized = false
    attempts = 0
})

// === Attempt handshake loop ===
basic.forever(function () {
    if (!initialized) {
        attempts += 1
        basic.showNumber(attempts)
        serial.writeLine("Attempt " + attempts + " - starting initialization")

        // 1. Wake sensor
        wakeSensor()

        // 2. Init at 2400
        initLPF2_2400()

        // 3. Try to read response at 2400
        serial.writeLine("Reading response at 2400 baud")
        let buf = serial.readBuffer(4)
        serial.writeLine("Received buffer length: " + buf.length)
        if (buf.length >= 3) {
            serial.writeLine("Buffer[0]: " + buf.getUint8(0))
        }
        if (buf.length >= 3 && buf.getUint8(0) == 0x41) {
            initialized = true
            basic.showString("G") // handshake success
            serial.writeLine("Handshake success - switching to 115200")
            // 4. Switch to 115200 for data
            switchBaud115200()
        } else {
            serial.writeLine("Handshake failed - retrying")
        }

        basic.pause(300) // retry delay if needed

    } else {
        // Read distance packets at 115200
        let buf = serial.readBuffer(4)
        if (buf.length >= 3 && buf.getUint8(0) == 0xC0) {
            let distance = buf.getUint8(1)
            basic.showNumber(distance)
            serial.writeLine("Distance: " + distance)
        }

        // Send keep-alive every 2 seconds
        if (control.millis() - lastKeepAlive > 2000) {
            serial.writeLine("Sending keep-alive")
            sendLPF2([0x21, 0x00]) // PORT_MODE_INFORMATION_REQUEST
            lastKeepAlive = control.millis()
        }
    }
})
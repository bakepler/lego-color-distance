from microbit import *

# Initialize UART (LPF2 commonly works at 115200 baud)
uart.init(baudrate=115200, tx=pin1, rx=pin2)

while True:
    if uart.any():
        data = uart.read()

        if data:
            # Convert first byte to integer distance (simple demo assumption)
            distance = data[0]

            # Display the distance number
            display.scroll(distance)

    sleep(100)

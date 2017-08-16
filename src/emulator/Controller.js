export default class Controller {
    constructor() {
        this.index = 0;
        this.buttons = new Array(8);
        this.strobe = 0;
    }

    read() {
        let value = 0
        if (this.index < 8 && this.buttons[this.index]) {
            value = 1
        }
        this.index++
        if (this.strobe & 1 == 1) {
            this.index = 0
        }
        return value
    }

    write(value) {
        this.strobe = value
        if (this.strobe & 1 == 1) {
            this.index = 0
        }
    }
}
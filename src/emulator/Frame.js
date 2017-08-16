export default class Frame {
    constructor() {
        this.image = new Array(256)
        for (var i = 0; i < this.image.length; i++) {
            this.image[i] = new Array(240);
            for (var j = 0; j < this.image[i].length; j++) {
                this.image[i][j] = {
                    r : 0x00, 
                    g : 0x00, 
                    b : 0x00, 
                    alpha : 0xFF
                };
            }
        }

    }

    getImage() {
        return this.image;
    }

    setRGBA(x, y, color) {
        this.image[x][y] = color;
    }

    getRGBA(x,y) {
        return this.image[x][y];
    }  
}
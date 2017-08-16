import CPU from './CPU';
import APU from './APU';
import PPU from './PPU';
import Cartridge from './Cartridge';
import Controller from './Controller';
import Palette from './Palette';

export default class NES {

    constructor() {
        this.CPU = new CPU(this);
        this.APU = new APU(this);
        this.PPU = new PPU(this);
        this.cartridge = new Cartridge(this);
        this.controller1 = new Controller(this);
        this.controller2 = new Controller(this);
        this.palette = new Palette();
        
        
        this.mapper = null;
    }

    setMapper(mapper) {
        console.log('Set mapper is set.')
        this.mapper = mapper
    }

    getMapper() {
        return this.mapper
    }

    // init a ROM
    init(path) {
        this.cartridge.loadRom(path).then((message) => {
            console.log(message);
            if(this.mapper) {
                console.log("Starting Emulation :")
                this.start();
            } else {
                console.log("Mapper Undefined")
            }

        }).catch(error => {
            console.log("Error Loading Rom : " + error);
        });
    }

    start() {
        this.CPU.reset();
        for (var index = 0; index < 100; index++) {
            this.step();
            
        }
    }


    backgroundColorRGBA() {
        let ppuBackgroundColorIndex = this.PPU.readPalette(0);
        return this.palette.getColorRGBA(ppuBackgroundColorIndex%64);
    }

    backgroundColorHex() {
        let ppuBackgroundColorIndex = this.PPU.readPalette(0);
        return this.palette.getColorHex(ppuBackgroundColorIndex%64);
    }

    reset() {
        this.CPU.reset();
    }
    
    // Steps everything to the next clock cycle
    step() {
        let cpuCycles = this.CPU.step()
        let ppuCycles = cpuCycles * 3

        for (let i = 0; i < ppuCycles; i++) {
            this.PPU.step()
            this.mapper.step()
        }
        for (let i = 0; i < cpuCycles; i++) {
            this.APU.step()
        }
        return cpuCycles;
        
    }

    // Step to the next frame by steping everything until the frames changes
    stepFrame() {
        var cpuCycles = 0
        var frameCounter = this.PPU.getFrameCounter();
        while (frameCounter !== this.PPU.getFrameCounter()) {
            cpuCycles += this.step()
        }
        return cpuCycles
    }

    stepSeconds(seconds) {
        var cycles = this.CPU.getCPUFrequency() * seconds
        while (cycles > 0) {
            cycles -= this.step()
        }
    }

    setAudioChannel(channel) {
        this.APU.setChannel(channel);
    }

    setAudioSampleRate(sampleRate) {
        if (sampleRate !== 0) {
            this.APU.setSampleRate(this.CPU.getCPUFrequency() / sampleRate);
            this.APU.setFilterChain(null);
        } else {
            this.APU.setFilterChain(null);
        }
    }
} 
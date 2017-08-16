/*import Mapper1 from './Mappers/Mapper1'
import Mapper2 from './Mappers/Mapper2'
import Mapper3 from './Mappers/Mapper3'
import Mapper4 from './Mappers/Mapper4'
import Mapper7 from './Mappers/Mapper7'*/

import Mapper2 from './Mappers/Mapper2'

export default class MapperManager {
    constructor(rom, ram) {
        this.mapper = new Mapper2(rom)
        this.rom = rom
    }

    getMapper() {
        return this.mapper;
    }

    getRom() {
        return this.rom
    }
    
    read(address) {
        return this.mapper.read(address)
    } 

    write(address,value) {
        this.mapper.write(address,value);
    }

    step() {
        this.mapper.step();
    }
}

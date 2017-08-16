import Memory from './Memory'

// Frequency : 1.79 Mhz
const CPUFrequency = 1789773;

const modeAbsolute = 0, modeAbsoluteX = 1, modeAbsoluteY = 2, modeAccumulator = 3, modeImmediate = 4, modeImplied = 5, modeIndexedIndirect = 6, modeIndirect = 7, modeIndirectIndexed = 8, modeRelative = 9, modeZeroPage = 10, modeZeroPageX = 11, modeZeroPageY = 12;

const interruptNone = 0,
    interruptNMI = 1,
    interruptIRQ = 2;


export default class CPU {
    constructor(nes) {
        this.nes = nes;
        this.memory = new Memory(nes);
        this.instructions = [];
        let callbacks = this.createCallbacks();

        for (let i = 0; i < 256; i++) {
            this.instructions.push({
                callback: callbacks[i],
                instructionName: instructionNames[i],
                instructionMode: instructionModes[i],
                instructionSize: instructionSizes[i],
                instructionCycle: instructionCycles[i],
                instructionPageCycle: instructionPageCycles[i]
            })
        }
        this.cycles = 0;
        this.PC = 0x0000;
        this.SP = 0;

        this.A = 0;   // accumulator
        this.X = 0;   // x register
        this.Y = 0;   // y register
        this.C = 0;   // carry flag
        this.Z = 0;   // zero flag
        this.I = 0;   // interrupt disable flag
        this.D = 0;   // decimal mode flag
        this.B = 0;   // break command flag
        this.U = 0;   // unused flag
        this.V = 0;   // overflow flag
        this.N = 0;   // negative flag

        this.stall = 0; // number of cycles to stall
        this.interrupt = 0; // interrupt type to perform

    }

    read(address) { 
       
        return this.memory.read(address)
    }

    write(address, value) {
        this.memory.write(address, value)
    }

    createCallbacks() {
        return [
            this.brk, this.ora, this.kil, this.slo, this.nop, this.ora, this.asl, this.slo,
            this.php, this.ora, this.asl, this.anc, this.nop, this.ora, this.asl, this.slo,
            this.bpl, this.ora, this.kil, this.slo, this.nop, this.ora, this.asl, this.slo,
            this.clc, this.ora, this.nop, this.slo, this.nop, this.ora, this.asl, this.slo,
            this.jsr, this.and, this.kil, this.rla, this.bit, this.and, this.rol, this.rla,
            this.plp, this.and, this.rol, this.anc, this.bit, this.and, this.rol, this.rla,
            this.bmi, this.and, this.kil, this.rla, this.nop, this.and, this.rol, this.rla,
            this.sec, this.and, this.nop, this.rla, this.nop, this.and, this.rol, this.rla,
            this.rti, this.eor, this.kil, this.sre, this.nop, this.eor, this.lsr, this.sre,
            this.pha, this.eor, this.lsr, this.alr, this.jmp, this.eor, this.lsr, this.sre,
            this.bvc, this.eor, this.kil, this.sre, this.nop, this.eor, this.lsr, this.sre,
            this.cli, this.eor, this.nop, this.sre, this.nop, this.eor, this.lsr, this.sre,
            this.rts, this.adc, this.kil, this.rra, this.nop, this.adc, this.ror, this.rra,
            this.pla, this.adc, this.ror, this.arr, this.jmp, this.adc, this.ror, this.rra,
            this.bvs, this.adc, this.kil, this.rra, this.nop, this.adc, this.ror, this.rra,
            this.sei, this.adc, this.nop, this.rra, this.nop, this.adc, this.ror, this.rra,
            this.nop, this.sta, this.nop, this.sax, this.sty, this.sta, this.stx, this.sax,
            this.dey, this.nop, this.txa, this.xaa, this.sty, this.sta, this.stx, this.sax,
            this.bcc, this.sta, this.kil, this.ahx, this.sty, this.sta, this.stx, this.sax,
            this.tya, this.sta, this.txs, this.tas, this.shy, this.sta, this.shx, this.ahx,
            this.ldy, this.lda, this.ldx, this.lax, this.ldy, this.lda, this.ldx, this.lax,
            this.tay, this.lda, this.tax, this.lax, this.ldy, this.lda, this.ldx, this.lax,
            this.bcs, this.lda, this.kil, this.lax, this.ldy, this.lda, this.ldx, this.lax,
            this.clv, this.lda, this.tsx, this.las, this.ldy, this.lda, this.ldx, this.lax,
            this.cpy, this.cmp, this.nop, this.dcp, this.cpy, this.cmp, this.dec, this.dcp,
            this.iny, this.cmp, this.dex, this.axs, this.cpy, this.cmp, this.dec, this.dcp,
            this.bne, this.cmp, this.kil, this.dcp, this.nop, this.cmp, this.dec, this.dcp,
            this.cld, this.cmp, this.nop, this.dcp, this.nop, this.cmp, this.dec, this.dcp,
            this.cpx, this.sbc, this.nop, this.isc, this.cpx, this.sbc, this.inc, this.isc,
            this.inx, this.sbc, this.nop, this.sbc, this.cpx, this.sbc, this.inc, this.isc,
            this.beq, this.sbc, this.kil, this.isc, this.nop, this.sbc, this.inc, this.isc,
            this.sed, this.sbc, this.nop, this.isc, this.nop, this.sbc, this.inc, this.isc,
        ];
    }

    // read16bug emulates a 6502 bug that caused the low byte to wrap without
    // incrementing the high byte
    readTwoBytesbug(address) {
        let a = address;
        let b = (a & 0xFF00) | (a + 1);
        let lo = this.read(a);
        let hi = this.read(b);
        return hi << 8 | lo;
    }

    step() {
        /*
        console.log("State: "+ 
        "\n-Cycles: " +this.cycles+
        "\n-Program Counter: 0x" +this.PC.toString(16) +
        "\n-Stack Pointer: 0x" +this.SP.toString(16)+
        "\n-Stack : " +this.read(this.SP).toString(16)
        
        +

        "\n-Accumulator: " +this.A+
        "\n-X Register: " +this.X+
        "\n-Y Register: " +this.Y +
        "\n-Carry Flag: " +this.C +
        "\n-Zero Flag: " +this.Z +
        "\n-Interrupt Disable Flag: " +this.I +
        "\n-Decimal Mode Flag: " +this.D +
        "\n-Break Command Flag: " +this.B +
        "\n-Unused Flag: " +this.U +
        "\n-Overflow Flag: " +this.V +
        "\n-Negative Flag: " +this.N );*/

        this.stall = 0; // number of cycles to stall
        this.interrupt = 0; // interrupt type to perform)
        if (this.stall > 0) {
            this.stall--;
            return 1;
        }

        let cycles = this.cycles

        switch (this.interrupt) {
            case interruptNMI:
                this.nmi();
                break;
            case interruptIRQ:
                this.irq();
                break;
            default:
                break;
        }

        this.interrupt = interruptNone;
        let opcode = this.read(this.PC);
        

        let mode = instructionModes[opcode];
        //console.log("\n-Mode: "+mode)
        let address;
        let pageCrossed;

        
        switch (mode) {
            case modeAbsolute:
                address = this.readTwoBytes(cpu.PC + 1)
                
                break;
            case modeAbsoluteX: 
                address = this.readTwoBytes(this.PC + 1) + this.X;
                pageCrossed = this.pagesDiffer(address - this.X, address);
                break;
            case modeAbsoluteY:
                address = this.readTwoBytes(this.PC + 1) + this.Y;
                pageCrossed = this.pagesDiffer(address - this.Y, address);
                break;
            case modeAccumulator:
                address = 0
                break;
            case modeImmediate:

                address = this.PC + 1;
                
                break;
            case modeImplied: 

                address = 0
                
                
                break;
            case modeIndexedIndirect:
            
                address = this.readTwoBytesbug(this.read(this.PC + 1) + this.X);
               
                break;
            case modeIndirect:
                address = this.readTwoBytesbug(this.readTwoBytes(this.PC + 1));
                break;
            case modeIndirectIndexed:
                address = this.readTwoBytesbug(this.read(this.PC + 1)) + this.Y;
                pageCrossed = this.pagesDiffer(address - this.Y, address);
                break;
            case modeRelative:
                let offset = this.read(this.PC + 1)
                if (offset < 0x80) {
                    address = this.PC + 2 + offset;
                } else {
                    address = this.PC + 2 + offset - 0x100;
                }
                break;
            case modeZeroPage:
                address = this.read(this.PC + 1)
                break;
            case modeZeroPageX:
                address = this.read(this.PC + 1) + this.X;
                break;
            case modeZeroPageY:
                address = this.read(this.PC + 1) + this.Y;
                break;
            default:
                break;
        }


        this.PC += this.instructions[opcode].instructionSize;

        this.cycles += this.instructions[opcode].instructionCycle
        if (pageCrossed) this.cycles += this.instructions[opcode].instructionPageCycle
        let info = { address, pc: this.PC, mode };
        this.instructions[opcode].callback.apply(this, [info]);

        console.log(instructionNames[opcode] + " adresse: 0x" + info.address.toString(16) +" PC: 0x" +info.pc.toString(16))

        return this.cycles - cycles;
    }

    reset() {
        this.PC = this.readTwoBytes(0xFFFC);
        this.SP = 0xFD;
        this.setFlags(0x24);
    }


    getCPUFrequency() {
        return CPUFrequency;
    }


    // pagesDiffer returns true if the two addresses reference different pages
    pagesDiffer(a, b) {
        return a & 0xFF00 != b & 0xFF00;
    }

    // addBranchCycles adds a cycle for taking a branch and adds another cycle
    // if the branch jumps to a new page
    addBranchCycles(info) {
        this.cycles++;
        if (this.pagesDiffer(info.pc, info.address)) {
            this.cycles++
        }
    }

    // Flags returns the processor status flags
    getFlags() {
        var flags
        flags |= this.C << 0
        flags |= this.Z << 1
        flags |= this.I << 2
        flags |= this.D << 3
        flags |= this.B << 4
        flags |= this.U << 5
        flags |= this.V << 6
        flags |= this.N << 7
        return flags
    }


    // setFlags sets the processor status flags
    setFlags(flags) {
        this.C = (flags >> 0) & 1
        this.Z = (flags >> 1) & 1
        this.I = (flags >> 2) & 1
        this.D = (flags >> 3) & 1
        this.B = (flags >> 4) & 1
        this.U = (flags >> 5) & 1
        this.V = (flags >> 6) & 1
        this.N = (flags >> 7) & 1
    }

    compare(a, b) {
        this.setZeroNegative(a - b);
        this.C = a >= b ? 1 : 0;
    }

    read(offset) {
        return this.memory.read(offset);
    }

    readTwoBytes(offset) {
        let lowerBytes = this.read(offset);
        let upperBytes = this.read(offset + 1);
        return upperBytes << 8 | lowerBytes;
    }

    push(value) {
        // Computes the offset based on the stack pointer
        let offset = 0x100 | this.SP;
        // Write the value into the stack
        this.memory.write(offset, value);
        // Decrement stack pointer
        this.SP--;
    }

    pull() {
        // Computes the offset based on the stack pointer
        let offset = 0x100 | this.SP;
        this.SP++;
        // return the read value
        return this.memory.read(offset)
    }

    pushTwoBytes(value) {
        let upperBytes = value >> 8;
        let lowerBytes = value & 0xFF;
        this.push(upperBytes);
        this.push(lowerBytes);
    }

    pullTwoBytes() {
        let lowerBytes = this.pull();
        let upperBytes = this.pull();

        return upperBytes << 8 | lowerBytes;
    }

    // setZero sets the zero flag if the argument is zero
    setZero(value) {
        if (value == 0) {
            this.Z = 1
        } else {
            this.Z = 0
        }
    }

    // setNegative sets the negative flag if the argument is negative (high bit is set)
    setNegative(value) {
        if (value & 0x80 != 0) {
            this.N = 1
        } else {
            this.N = 0
        }
    }

    setZeroNegative(value) {
        this.setZero(value);
        this.setNegative(value);
    }

    // NMI - Non-Maskable Interrupt
    nmi() {
        this.pushTwoBytes(this.PC)
        this.php(null)
        this.PC = this.readTwoBytes(0xFFFA)
        this.I = 1
        this.cycles += 7
    }

    // IRQ - IRQ Interrupt
    irq() {
        this.pushTwoBytes(this.PC)
        this.php(null)
        this.PC = this.readTwoBytes(0xFFFE)
        this.I = 1
        this.cycles += 7
    }

    // ADC - Add with Carry
    adc(info) {
        let a = this.A;
        let b = this.read(info.address)
        let c = this.C;
        this.A = a + b + c;
        this.setZeroNegative(this.A);
        this.C = this.A > 0xFF ? 1 : 0;
        this.V = (a ^ b) & 0x80 == 0 && (a ^ this.A) & 0x80 != 0 ? 1 : 0;
    }

    // AND - Logical AND
    and(info) {
        this.A = this.A & this.read(info.address);
        this.setZeroNegative(this.A);
    }

    // ASL - Arithmetic Shift Left
    asl(info) {
        if (info.mode == modeAccumulator) {
            this.C = (this.A >> 7) & 1
            this.A <<= 1
            this.setZeroNegative(this.A)
        } else {
            let value = this.read(info.address)
            this.C = (value >> 7) & 1
            value <<= 1
            this.write(info.address, value)
            this.setZeroNegative(value)
        }
    }
    // BCC - Branch if Carry Clear
    bcc(info) {
        if (this.C == 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }
    // BCS - Branch if Carry Set
    bcs(info) {
        if (this.C != 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }

    // BEQ - Branch if Equal
    beq(info) {
        if (this.Z != 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }
    // BIT - Bit Test
    bit(info) {
        let value = this.read(info.address)
        this.V = (value >> 6) & 1
        this.setZero(value & this.A)
        this.setNegative(value)
    }

    // BMI - Branch if Minus
    bmi(info) {
        if (this.N != 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }

    // BNE - Branch if Not Equal
    bne(info) {
        if (this.Z == 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }

    // BPL - Branch if Positive
    bpl(info) {
        if (this.N == 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }

    // BRK - Force Interrupt
    brk(info) {
        this.pushTwoBytes(this.PC)
        this.php(info)
        this.sei(info)
        this.PC = this.readTwoBytes(0xFFFE)
    }

    // BVC - Branch if Overflow Clear
    bvc(info) {
        if (this.V == 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }

    // BVS - Branch if Overflow Set
    bvs(info) {
        if (this.V != 0) {
            this.PC = info.address
            this.addBranchCycles(info)
        }
    }

    // CLC - Clear Carry Flag
    clc(info) {
        this.C = 0
    }

    // CLD - Clear Decimal Mode
    cld(info) {
        this.D = 0
    }

    // CLI - Clear Interrupt Disable
    cli(info) {
        this.I = 0
    }

    // CLV - Clear Overflow Flag
    clv(info) {
        this.V = 0
    }

    // CMP - Compare
    cmp(info) {
        let value = this.read(info.address)
        this.compare(this.A, value)
    }

    // CPX - Compare X Register
    cpx(info) {
        let value = this.read(info.address)
        this.compare(this.X, value)
    }

    // CPY - Compare Y Register
    cpy(info) {
        let value = this.read(info.address)
        this.compare(this.Y, value)
    }

    // DEC - Decrement Memory
    dec(info) {
        let value = this.read(info.address) - 1
        this.write(info.address, value)
        this.setZeroNegative(value)
    }

    // DEX - Decrement X Register
    dex(info) {
        this.X--
        this.setZeroNegative(this.X)
    }

    // DEY - Decrement Y Register
    dey(info) {
        this.Y--
        this.setZeroNegative(this.Y)
    }

    // EOR - Exclusive OR
    eor(info) {
        this.A = this.A ^ this.read(info.address)
        this.setZeroNegative(this.A)
    }

    // INC - Increment Memory
    inc(info) {
        let value = this.read(info.address) + 1
        this.write(info.address, value)
        this.setZeroNegative(value)
    }

    // INX - Increment X Register
    inx(info) {
        this.X++
        this.setZeroNegative(this.X)
    }

    // INY - Increment Y Register
    iny(info) {
        this.Y++
        this.setZeroNegative(this.Y)
    }

    // JMP - Jump
    jmp(info) {
        this.PC = info.address
    }

    // JSR - Jump to Subroutine
    jsr(info) {
        this.pushTwoBytes(this.PC - 1)
        this.PC = info.address
    }

    // LDA - Load Accumulator
    lda(info) {
        this.A = this.read(info.address)
        this.setZeroNegative(this.A)
    }

    // LDX - Load X Register
    ldx(info) {
        this.X = this.read(info.address)
        this.setZeroNegative(this.X)
    }

    // LDY - Load Y Register
    ldy(info) {
        this.Y = this.read(info.address);
        this.setZeroNegative(this.Y);
    }

    // LSR - Logical Shift Right
    lsr(info) {
        if (info.mode == modeAccumulator) {
            this.C = this.A & 1
            this.A >>= 1
            this.setZeroNegative(this.A)
        } else {
            let value = this.read(info.address)
            this.C = value & 1
            value >>= 1
            this.write(info.address, value)
            this.setZeroNegative(value)
        }
    }

    // NOP - No Operation
    nop(info) {
    }

    // ORA - Logical Inclusive OR
    ora(info) {
        this.A = this.A | this.read(info.address)
        this.setZeroNegative(this.A)
    }

    // PHA - Push Accumulator
    pha(info) {
        this.push(this.A)
    }

    // PHP - Push Processor Status
    php(info) {
        this.push(this.getFlags() | 0x10)
    }

    // PLA - Pull Accumulator
    pla(info) {
        this.A = this.pull()
        this.setZeroNegative(this.A);
    }

    // PLP - Pull Processor Status
    plp(info) {
        this.setFlags(this.pull() & 0xEF | 0x20);
    }

    // ROL - Rotate Left
    rol(info) {
        let c = this.C
        if (info.mode == modeAccumulator) {
            this.C = (this.A >> 7) & 1
            this.A = (this.A << 1) | c
            this.setZeroNegative(this.A)
        } else {
            let value = this.read(info.address)
            this.C = (value >> 7) & 1
            value = (value << 1) | c
            this.write(info.address, value)
            this.setZeroNegative(value)
        }
    }

    // ROR - Rotate Right
    ror(info) {
        let c = this.C
        if (info.mode == modeAccumulator) {
            this.C = this.A & 1
            this.A = (this.A >> 1) | (c << 7)
            this.setZeroNegative(this.A)
        } else {
            let value = this.read(info.address)
            this.C = value & 1
            value = (value >> 1) | (c << 7)
            this.write(info.address, value)
            this.setZeroNegative(value)
        }
    }

    // RTI - Return from Interrupt
    rti(info) {
        this.setFlags(this.pull() & 0xEF | 0x20)
        this.PC = this.pullTwoBytes()
    }

    // RTS - Return from Subroutine
    rts(info) {
        this.PC = this.pullTwoBytes() + 1
    }

    // SBC - Subtract with Carry
    sbc(info) {
        let a = this.A
        let b = this.read(info.address)
        let c = this.C
        this.A = a - b - (1 - c)
        this.setZeroNegative(this.A)
        this.C = this.A >= 0 ? 1 : 0;
        this.V = (a ^ b) & 0x80 != 0 && (a ^ this.A) & 0x80 != 0 ? 1 : 0;
    }

    // SEC - Set Carry Flag
    sec(info) {
        this.C = 1
    }

    // SED - Set Decimal Flag
    sed(info) {
        this.D = 1
    }

    // SEI - Set Interrupt Disable
    // Console log
    sei(info) {
        this.I = 1
    }

    // STA - Store Accumulator
    sta(info) {
        this.write(info.address, this.A)
    }

    // STX - Store X Register
    stx(info) {
        this.write(info.address, this.X)
    }

    // STY - Store Y Register
    sty(info) {
        this.write(info.address, this.Y)
    }

    // TAX - Transfer Accumulator to X
    tax(info) {
        this.X = this.A
        this.setZeroNegative(this.X)
    }

    // TAY - Transfer Accumulator to Y
    tay(info) {
        this.Y = this.A
        this.setZeroNegative(this.Y)
    }

    // TSX - Transfer Stack Pointer to X
    tsx(info) {
        this.X = this.SP
        this.setZeroNegative(this.X)
    }

    // TXA - Transfer X to Accumulator
    txa(info) {
        this.A = this.X
        this.setZeroNegative(this.A)
    }

    // TXS - Transfer X to Stack Pointer
    txs(info) {
        this.SP = this.X
    }

    // TYA - Transfer Y to Accumulator
    tya(info) {
        this.A = this.Y
        this.setZeroNegative(this.A)
    }

    // illegal opcodes below

    ahx(info) {
    }

    alr(info) {
    }

    anc(info) {
    }

    arr(info) {
    }

    axs(info) {
    }

    dcp(info) {
    }

    isc(info) {
    }

    kil(info) {
    }

    las(info) {
    }

    lax(info) {
    }

    rla(info) {
    }

    rra(info) {
    }

    sax(info) {
    }

    shx(info) {
    }

    shy(info) {
    }

    slo(info) {
    }

    sre(info) {
    }

    tas(info) {
    }

    xaa(info) {
    }

    // triggerNMI causes a non-maskable interrupt to occur on the next cycle
    triggerNMI() {
        console.log("triggerNMI")
        this.interrupt = interruptNMI
    }

    // triggerIRQ causes an IRQ interrupt to occur on the next cycle
    triggerIRQ() {
        console.log("triggerIRQ")
        if (this.I == 0) {
            this.interrupt = interruptIRQ
        }
    }
}




// instructionModes indicates the addressing mode for each instruction
const instructionModes = [
    6, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    1, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    6, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    6, 7, 6, 7, 11, 11, 11, 11, 6, 5, 4, 5, 8, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 13, 13, 6, 3, 6, 3, 2, 2, 3, 3,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 13, 13, 6, 3, 6, 3, 2, 2, 3, 3,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2,
    5, 7, 5, 7, 11, 11, 11, 11, 6, 5, 6, 5, 1, 1, 1, 1,
    10, 9, 6, 9, 12, 12, 12, 12, 6, 3, 6, 3, 2, 2, 2, 2
]

// instructionSizes indicates the size of each instruction in bytes
const instructionSizes = [
    1, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,
    3, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,
    1, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,
    1, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 0, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 0, 3, 0, 0,
    2, 2, 2, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,
    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0
]

// instructionCycles indicates the number of cycles used by each instruction,
// not including conditional cycles
const instructionCycles = [
    7, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    6, 6, 2, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    6, 6, 2, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
    2, 6, 2, 6, 4, 4, 4, 4, 2, 5, 2, 5, 5, 5, 5, 5,
    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 2, 4, 4, 4, 4,
    2, 5, 2, 5, 4, 4, 4, 4, 2, 4, 2, 4, 4, 4, 4, 4,
    2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7,
    2, 6, 2, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 6, 6,
    2, 5, 2, 8, 4, 4, 6, 6, 2, 4, 2, 7, 4, 4, 7, 7
]

// instructionPageCycles indicates the number of cycles used by each
// instruction when a page is crossed
const instructionPageCycles = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 1, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0
]

// instructionNames indicates the name of each instruction
const instructionNames = [
    "BRK", "ORA", "KIL", "SLO", "NOP", "ORA", "ASL", "SLO",
    "PHP", "ORA", "ASL", "ANC", "NOP", "ORA", "ASL", "SLO",
    "BPL", "ORA", "KIL", "SLO", "NOP", "ORA", "ASL", "SLO",
    "CLC", "ORA", "NOP", "SLO", "NOP", "ORA", "ASL", "SLO",
    "JSR", "AND", "KIL", "RLA", "BIT", "AND", "ROL", "RLA",
    "PLP", "AND", "ROL", "ANC", "BIT", "AND", "ROL", "RLA",
    "BMI", "AND", "KIL", "RLA", "NOP", "AND", "ROL", "RLA",
    "SEC", "AND", "NOP", "RLA", "NOP", "AND", "ROL", "RLA",
    "RTI", "EOR", "KIL", "SRE", "NOP", "EOR", "LSR", "SRE",
    "PHA", "EOR", "LSR", "ALR", "JMP", "EOR", "LSR", "SRE",
    "BVC", "EOR", "KIL", "SRE", "NOP", "EOR", "LSR", "SRE",
    "CLI", "EOR", "NOP", "SRE", "NOP", "EOR", "LSR", "SRE",
    "RTS", "ADC", "KIL", "RRA", "NOP", "ADC", "ROR", "RRA",
    "PLA", "ADC", "ROR", "ARR", "JMP", "ADC", "ROR", "RRA",
    "BVS", "ADC", "KIL", "RRA", "NOP", "ADC", "ROR", "RRA",
    "SEI", "ADC", "NOP", "RRA", "NOP", "ADC", "ROR", "RRA",
    "NOP", "STA", "NOP", "SAX", "STY", "STA", "STX", "SAX",
    "DEY", "NOP", "TXA", "XAA", "STY", "STA", "STX", "SAX",
    "BCC", "STA", "KIL", "AHX", "STY", "STA", "STX", "SAX",
    "TYA", "STA", "TXS", "TAS", "SHY", "STA", "SHX", "AHX",
    "LDY", "LDA", "LDX", "LAX", "LDY", "LDA", "LDX", "LAX",
    "TAY", "LDA", "TAX", "LAX", "LDY", "LDA", "LDX", "LAX",
    "BCS", "LDA", "KIL", "LAX", "LDY", "LDA", "LDX", "LAX",
    "CLV", "LDA", "TSX", "LAS", "LDY", "LDA", "LDX", "LAX",
    "CPY", "CMP", "NOP", "DCP", "CPY", "CMP", "DEC", "DCP",
    "INY", "CMP", "DEX", "AXS", "CPY", "CMP", "DEC", "DCP",
    "BNE", "CMP", "KIL", "DCP", "NOP", "CMP", "DEC", "DCP",
    "CLD", "CMP", "NOP", "DCP", "NOP", "CMP", "DEC", "DCP",
    "CPX", "SBC", "NOP", "ISC", "CPX", "SBC", "INC", "ISC",
    "INX", "SBC", "NOP", "SBC", "CPX", "SBC", "INC", "ISC",
    "BEQ", "SBC", "KIL", "ISC", "NOP", "SBC", "INC", "ISC",
    "SED", "SBC", "NOP", "ISC", "NOP", "SBC", "INC", "ISC"
]

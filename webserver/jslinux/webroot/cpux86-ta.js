/*
   PC Emulator
 
   Copyright (c) 2011 Fabrice Bellard
 
   Redistribution or commercial use is prohibited without the author'Signed
   permission.
*/
"use strict";

var parity_table = [1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1];
var one_F_mask = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
var one_F_mask2 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3, 4];

function CPU_X86() {
    var i, MemorySize;
    this.regs = new Array();
    for (i = 0; i < 8; i++) this.regs[i] = 0;
    this.eip = 0;
    this.cc_op = 0;
    this.cc_dst = 0;
    this.cc_src = 0;
    this.cc_op2 = 0;
    this.cc_dst2 = 0;
    this.df = 1;
    this.eflags = 0x2;
    this.cycle_count = 0;
    this.hard_irq = 0;
    this.hard_intno = -1;
    this.cpl = 0;
    this.cr0 = (1 << 0);
    this.cr2 = 0;
    this.cr3 = 0;
    this.cr4 = 0;
    this.idt = {
        base: 0,
        limit: 0
    };
    this.gdt = {
        base: 0,
        limit: 0
    };
    this.SegDescriptors = new Array();
    for (i = 0; i < 7; i++) {
        this.SegDescriptors[i] = {
            selector: 0,
            base: 0,
            limit: 0,
            flags: 0
        };
    }
    this.SegDescriptors[2].flags = (1 << 22);
    this.SegDescriptors[1].flags = (1 << 22);
    this.tr = {
        selector: 0,
        base: 0,
        limit: 0,
        flags: 0
    };
    this.ldt = {
        selector: 0,
        base: 0,
        limit: 0,
        flags: 0
    };
    this.halted = 0;
    this.phys_mem = null;
    MemorySize = 0x100000;
    this.tlb_read_kernel = new Int32Array(MemorySize);
    this.tlb_write_kernel = new Int32Array(MemorySize);
    this.tlb_read_user = new Int32Array(MemorySize);
    this.tlb_write_user = new Int32Array(MemorySize);
    for (i = 0; i < MemorySize; i++) {
        this.tlb_read_kernel[i] = -1;
        this.tlb_write_kernel[i] = -1;
        this.tlb_read_user[i] = -1;
        this.tlb_write_user[i] = -1;
    }
    this.tlb_pages = new Int32Array(2048);
    this.tlb_pages_count = 0;
}

//set physical memory size
CPU_X86.prototype.phys_mem_resize = function(ea) {
    this.mem_size = ea;
    ea += ((15 + 3) & ~3);
    this.phys_mem = new ArrayBuffer(ea);
    this.phys_mem8 = new Uint8Array(this.phys_mem, 0, ea);
    this.phys_mem16 = new Uint16Array(this.phys_mem, 0, ea / 2);
    this.phys_mem32 = new Int32Array(this.phys_mem, 0, ea / 4);
};

CPU_X86.prototype.ld8_phys = function(v_addr) {
    return this.phys_mem8[v_addr];
};
CPU_X86.prototype.st8_phys = function(v_addr, data) {
    this.phys_mem8[v_addr] = data;
};

CPU_X86.prototype.ld32_phys = function(v_addr) {
    return this.phys_mem32[v_addr >> 2];
};
CPU_X86.prototype.st32_phys = function(v_addr, data) {
    this.phys_mem32[v_addr >> 2] = data;
};

//it seems that the function fill the memory map table.
//virtual -> physical
//virtual ^ physical is saved
CPU_X86.prototype.tlb_set_page = function(v_addr, ha, ia, ja) {
    var i, data, j;
	
    ha &= -4096;
    v_addr &= -4096;
    data = v_addr ^ ha;
    i = v_addr >>> 12;
	
    if (this.tlb_read_kernel[i] == -1) {
		//tlb_pages is full, so we need to reset it.
		//and insert i into it.
		//but don't know why i-1 is set.
        if (this.tlb_pages_count >= 2048) {
            this.tlb_flush_all_and_init((i - 1) & 0xfffff);
        }
        this.tlb_pages[this.tlb_pages_count++] = i;
    }
    this.tlb_read_kernel[i] = data;
    if (ia) {
        this.tlb_write_kernel[i] = data;
    } else {
        this.tlb_write_kernel[i] = -1;
    }
    if (ja) {
        this.tlb_read_user[i] = data;
        if (ia) {
            this.tlb_write_user[i] = data;
        } else {
            this.tlb_write_user[i] = -1;
        }
    } else {
        this.tlb_read_user[i] = -1;
        this.tlb_write_user[i] = -1;
    }
};

//clear mmt(memory map table)'Signed entry
CPU_X86.prototype.tlb_flush_page = function(v_addr) {
    var i;
    i = v_addr >>> 12;
    this.tlb_read_kernel[i] = -1;
    this.tlb_write_kernel[i] = -1;
    this.tlb_read_user[i] = -1;
    this.tlb_write_user[i] = -1;
};

//clear all mmt
CPU_X86.prototype.tlb_flush_all = function() {
    var i, j, n, alias_tlb_pages;
    alias_tlb_pages = this.tlb_pages;
    n = this.tlb_pages_count;
    for (j = 0; j < n; j++) {
        i = alias_tlb_pages[j];
        this.tlb_read_kernel[i] = -1;
        this.tlb_write_kernel[i] = -1;
        this.tlb_read_user[i] = -1;
        this.tlb_write_user[i] = -1;
    }
    this.tlb_pages_count = 0;
};

//flush tlb_pages and init some entries with tar_addr.
CPU_X86.prototype.tlb_flush_all_and_init = function(tar_addr) {
    var vir_addr, i, mark;
    mark = 0;
    for (i = 0; i < this.tlb_pages_count; i++) {
        vir_addr = this.tlb_pages[i];
        if (vir_addr == tar_addr) {
            this.tlb_pages[mark++] = vir_addr;
        } else {
            this.tlb_read_kernel[vir_addr] = -1;
            this.tlb_write_kernel[vir_addr] = -1;
            this.tlb_read_user[vir_addr] = -1;
            this.tlb_write_user[vir_addr] = -1;
        }
    }
    this.tlb_pages_count = mark;
};

CPU_X86.prototype.write_string = function(addr, text) {
    var i;
    for (i = 0; i < text.length; i++) {
        this.st8_phys(addr++, text.charCodeAt(i) & 0xff);
    }
    this.st8_phys(addr, 0);
};

function to_hex_string(number, n) {
    var i, res = "";
    var hex_text = "0123456789ABCDEF";
    for (i = n - 1; i >= 0; i--) {
        res = res + hex_text[(number >>> (i * 4)) & 15];
    }
    return res;
}

function number32_to_string(number) {
    return to_hex_string(number, 8);
}

function number8_to_string(number) {
    return to_hex_string(number, 2);
}

function number16_to_string(number) {
    return to_hex_string(number, 4);
}

var instruction_limit = 500;
var instruction_counter = 0;
var instruction_op = 0;
CPU_X86.prototype.dump_short = function() {
	if (instruction_counter < instruction_limit) {
		console.log(instruction_counter + ". " + number8_to_string(instruction_op));
		console.log("EIP=" + number32_to_string(this.eip) 
		+ " EAX=" + number32_to_string(this.regs[0]) 
		+ " ECX=" + number32_to_string(this.regs[1]) 
		+ " EDX=" + number32_to_string(this.regs[2]) 
		+ " EBX=" + number32_to_string(this.regs[3]));
		console.log("EFL=" + number32_to_string(this.eflags) 
		+ " ESP=" + number32_to_string(this.regs[4]) 
		+ " EBP=" + number32_to_string(this.regs[5]) 
		+ " ESI=" + number32_to_string(this.regs[6]) 
		+ " EDI=" + number32_to_string(this.regs[7]));

		instruction_counter = instruction_counter + 1;
	}
};

//SRC and OP can be used to calculate carry
CPU_X86.prototype.dump = function() {
    this.dump_short();    
	/*
	var i, sa, na;
    var ta = [" ES", " CS", " SS", " DS", " FS", " GS", "LDT", " TR"];

    console.log("TSC=" + number32_to_string(this.cycle_count) 
	+ " OP=" + number8_to_string(this.cc_op) 
	+ " SRC=" + number32_to_string(this.cc_src) 
	+ " DST=" + number32_to_string(this.cc_dst) 
	+ " OP2=" + number8_to_string(this.cc_op2) 
	+ " DST2=" + number32_to_string(this.cc_dst2));
    console.log("CPL=" + this.cpl 
	+ " CR0=" + number32_to_string(this.cr0) 
	+ " CR2=" + number32_to_string(this.cr2) 
	+ " CR3=" + number32_to_string(this.cr3) 
	+ " CR4=" + number32_to_string(this.cr4));
    na = "";
    for (i = 0; i < 8; i++) {
        if (i == 6) sa = this.ldt;
        else if (i == 7) sa = this.tr;
        else sa = this.SegDescriptors[i];
        na += ta[i] + "=" + number16_to_string(sa.selector) + " " + number32_to_string(sa.base) + " " + number32_to_string(sa.limit) + " " + number16_to_string((sa.flags >> 8) & 0xf0ff);
        if (i & 1) {
            console.log(na);
            na = "";
        } else {
            na += " ";
        }
    }
    sa = this.gdt;
    na = "GDT=     " + number32_to_string(sa.base) + " " + number32_to_string(sa.limit) + "      ";
    sa = this.idt;
    na += "IDT=     " + number32_to_string(sa.base) + " " + number32_to_string(sa.limit);
    console.log(na);*/
};

CPU_X86.prototype.exec_internal = function(ua, va) {
    var alias_CPU_X86, v_addr, Registers;

	var EAXIndex = 0;
	var ECXIndex = 1;
	var EDXIndex = 2;
	var EBXIndex = 3;
	var ESPIndex = 4;
	var EBPIndex = 5;
	var ESIIndex = 6;
	var EDIIndex = 7;

    var SRC, ZeroFlag, OP, OP2, DST2;
    var Da, ModRM, RMIndex, CurrentByteOfCodeSeg, RegIndex, data, Operand, Operand2, CommandIndex, Ka, ErrorCode, ExtrsPartResult/*in mul intruction or others*/;
    var Na, Oa, Pa, Qa, Ra, Sa;
    var alias_phys_mem8, value;
    var alias_phys_mem16, alias_phys_mem32;
    var alias_tlb_read_kernel, alias_tlb_write_kernel, alias_tlb_read_user, alias_tlb_write_user, alias_tlb_read, alias_tlb_write;

    function LoadByteFromMissingVaddrReadOnly() {
        var temp;
        LoadMissingVaddrIntoPageTable(v_addr, 0, alias_CPU_X86.cpl == 3);
        temp = alias_tlb_read[v_addr >>> 12] ^ v_addr;
        return alias_phys_mem8[temp];
    }
    function ReadByteFromVaddrReadOnly() {
        var value;
        return (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
    }
    function ReadShortFromUnalignedVaddrReadOnly() {
        var data;
        data = ReadByteFromVaddrReadOnly();
        v_addr++;
        data |= ReadByteFromVaddrReadOnly() << 8;
        v_addr--;
        return data;
    }
    function ReadShortFromVaddrReadOnly() {
        var value;
        return (((value = alias_tlb_read[v_addr >>> 12]) | v_addr) & 1 ? ReadShortFromUnalignedVaddrReadOnly() : alias_phys_mem16[(v_addr ^ value) >> 1]);
    }
    function ReadIntFromUnalignedVaddrReadOnly() {
        var data;
        data = ReadByteFromVaddrReadOnly();
        v_addr++;
        data |= ReadByteFromVaddrReadOnly() << 8;
        v_addr++;
        data |= ReadByteFromVaddrReadOnly() << 16;
        v_addr++;
        data |= ReadByteFromVaddrReadOnly() << 24;
        v_addr -= 3;
        return data;
    }
    function ReadIntFromVaddrReadOnly() {
        var value;
        return (((value = alias_tlb_read[v_addr >>> 12]) | v_addr) & 3 ? ReadIntFromUnalignedVaddrReadOnly() : alias_phys_mem32[(v_addr ^ value) >> 2]);
    }
    function LoadByteFromMissingVaddrReadWrite() {
        var temp;
        LoadMissingVaddrIntoPageTable(v_addr, 1, alias_CPU_X86.cpl == 3);
        temp = alias_tlb_write[v_addr >>> 12] ^ v_addr;
        return alias_phys_mem8[temp];
    }
    function ReadByteFromVaddrReadWrite() {
        var temp;
        return ((temp = alias_tlb_write[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadWrite() : alias_phys_mem8[v_addr ^ temp];
    }
    function ReadShortFromUnalignedVaddrReadWrite() {
        var data;
        data = ReadByteFromVaddrReadWrite();
        v_addr++;
        data |= ReadByteFromVaddrReadWrite() << 8;
        v_addr--;
        return data;
    }
    function ReadShortFromVaddrReadWrite() {
        var temp;
        return ((temp = alias_tlb_write[v_addr >>> 12]) | v_addr) & 1 ? ReadShortFromUnalignedVaddrReadWrite() : alias_phys_mem16[(v_addr ^ temp) >> 1];
    }
    function ReadIntFromUnalignedVaddrReadWrite() {
        var data;
        data = ReadByteFromVaddrReadWrite();
        v_addr++;
        data |= ReadByteFromVaddrReadWrite() << 8;
        v_addr++;
        data |= ReadByteFromVaddrReadWrite() << 16;
        v_addr++;
        data |= ReadByteFromVaddrReadWrite() << 24;
        v_addr -= 3;
        return data;
    }
    function ReadIntFromVaddrReadWrite() {
        var temp;
        return ((temp = alias_tlb_write[v_addr >>> 12]) | v_addr) & 3 ? ReadIntFromUnalignedVaddrReadWrite() : alias_phys_mem32[(v_addr ^ temp) >> 2];
    }

    function ProcessMemoryException(data) {
        var temp;
        LoadMissingVaddrIntoPageTable(v_addr, 1, alias_CPU_X86.cpl == 3);
        temp = alias_tlb_write[v_addr >>> 12] ^ v_addr;
        alias_phys_mem8[temp] = data;
    }

    function WriteByteToVaddr(data) {
        var value; {
            value = alias_tlb_write[v_addr >>> 12];
            if (value == -1) {
                ProcessMemoryException(data);
            } else {
                alias_phys_mem8[v_addr ^ value] = data;
            }
        };
    }
    function WriteShortToUnalignedVaddr(data) {
        WriteByteToVaddr(data);
        v_addr++;
        WriteByteToVaddr(data >> 8);
        v_addr--;
    }
    function WriteShortToVaddr(data) {
        var value; {
            value = alias_tlb_write[v_addr >>> 12];
            if ((value | v_addr) & 1) {
                WriteShortToUnalignedVaddr(data);
            } else {
                alias_phys_mem16[(v_addr ^ value) >> 1] = data;
            }
        };
    }
    function WriteIntToUnalignedVaddr(data) {
        WriteByteToVaddr(data);
        v_addr++;
        WriteByteToVaddr(data >> 8);
        v_addr++;
        WriteByteToVaddr(data >> 16);
        v_addr++;
        WriteByteToVaddr(data >> 24);
        v_addr -= 3;
    }
    function WriteIntToVaddr(data) {
        var value; {
            value = alias_tlb_write[v_addr >>> 12];
            if ((value | v_addr) & 3) {
                WriteIntToUnalignedVaddr(data);
            } else {
                alias_phys_mem32[(v_addr ^ value) >> 2] = data;
            }
        };
    }
    function LoadByteFromMissingVaddrReadOnlySys() {
        var temp;
        LoadMissingVaddrIntoPageTable(v_addr, 0, 0);
        temp = alias_tlb_read_kernel[v_addr >>> 12] ^ v_addr;
        return alias_phys_mem8[temp];
    }
    function ReadByteFromVaddrReadOnlySys() {
        var temp;
        return ((temp = alias_tlb_read_kernel[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnlySys() : alias_phys_mem8[v_addr ^ temp];
    }
    function ReadShortFromUnalignedVaddrReadOnlySys() {
        var data;
        data = ReadByteFromVaddrReadOnlySys();
        v_addr++;
        data |= ReadByteFromVaddrReadOnlySys() << 8;
        v_addr--;
        return data;
    }
    function ReadShortFromVaddrReadOnlySys() {
        var temp;
        return ((temp = alias_tlb_read_kernel[v_addr >>> 12]) | v_addr) & 1 ? ReadShortFromUnalignedVaddrReadOnlySys() : alias_phys_mem16[(v_addr ^ temp) >> 1];
    }
    function ReadIntFromUnalignedVaddrReadOnlySys() {
        var data;
        data = ReadByteFromVaddrReadOnlySys();
        v_addr++;
        data |= ReadByteFromVaddrReadOnlySys() << 8;
        v_addr++;
        data |= ReadByteFromVaddrReadOnlySys() << 16;
        v_addr++;
        data |= ReadByteFromVaddrReadOnlySys() << 24;
        v_addr -= 3;
        return data;
    }
    function ReadIntFromVaddrReadOnlySys() {
        var temp;
        return ((temp = alias_tlb_read_kernel[v_addr >>> 12]) | v_addr) & 3 ? ReadIntFromUnalignedVaddrReadOnlySys() : alias_phys_mem32[(v_addr ^ temp) >> 2];
    }
    function WriteByteToMissingVaddrReadWriteSys(data) {
        var temp;
        LoadMissingVaddrIntoPageTable(v_addr, 1, 0);
        temp = alias_tlb_write_kernel[v_addr >>> 12] ^ v_addr;
        alias_phys_mem8[temp] = data;
    }
    function WriteByteToVaddrReadWriteSys(data) {
        var temp;
        temp = alias_tlb_write_kernel[v_addr >>> 12];
        if (temp == -1) {
            WriteByteToMissingVaddrReadWriteSys(data);
        } else {
            alias_phys_mem8[v_addr ^ temp] = data;
        }
    }
    function WriteShortToUnalignedVaddrReadWriteSys(data) {
        WriteByteToVaddrReadWriteSys(data);
        v_addr++;
        WriteByteToVaddrReadWriteSys(data >> 8);
        v_addr--;
    }
    function WriteShortFromVaddrReadWriteSys(data) {
        var temp;
        temp = alias_tlb_write_kernel[v_addr >>> 12];
        if ((temp | v_addr) & 1) {
            WriteShortToUnalignedVaddrReadWriteSys(data);
        } else {
            alias_phys_mem16[(v_addr ^ temp) >> 1] = data;
        }
    }
    function WriteIntToUnalignedVaddrReadWriteSys(data) {
        WriteByteToVaddrReadWriteSys(data);
        v_addr++;
        WriteByteToVaddrReadWriteSys(data >> 8);
        v_addr++;
        WriteByteToVaddrReadWriteSys(data >> 16);
        v_addr++;
        WriteByteToVaddrReadWriteSys(data >> 24);
        v_addr -= 3;
    }
    function WriteIntToVaddrReadWriteSys(data) {
        var temp;
        temp = alias_tlb_write_kernel[v_addr >>> 12];
        if ((temp | v_addr) & 3) {
            WriteIntToUnalignedVaddrReadWriteSys(data);
        } else {
            alias_phys_mem32[(v_addr ^ temp) >> 2] = data;
        }
    }
    var EIPDword, EIPDbyte, Lb, Mb, Nb;
    function Ob() {
        var data, Operand;
        data = alias_phys_mem8[EIPDbyte++];;
        Operand = alias_phys_mem8[EIPDbyte++];;
        return data | (Operand << 8);
    }
    function SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM) {
        var base, v_addr, Qb, Rb, SegRegIndex, Tb;
        if (Qa && (Da & (0x000f | 0x0080)) == 0) {
            switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
            case 0x04:
                Qb = alias_phys_mem8[EIPDbyte++];;
                base = Qb & 7;
                if (base == 5) {
                    {
                        v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    };
                } else {
                    v_addr = Registers[base];
                }
                Rb = (Qb >> 3) & 7;
                if (Rb != 4) {
                    v_addr = (v_addr + (Registers[Rb] << (Qb >> 6))) >> 0;
                }
                break;
            case 0x0c:
                Qb = alias_phys_mem8[EIPDbyte++];;
                v_addr = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                base = Qb & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                Rb = (Qb >> 3) & 7;
                if (Rb != 4) {
                    v_addr = (v_addr + (Registers[Rb] << (Qb >> 6))) >> 0;
                }
                break;
            case 0x14:
                Qb = alias_phys_mem8[EIPDbyte++];; {
                    v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                base = Qb & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                Rb = (Qb >> 3) & 7;
                if (Rb != 4) {
                    v_addr = (v_addr + (Registers[Rb] << (Qb >> 6))) >> 0;
                }
                break;
            case 0x05:
                {
                    v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                break;
            case 0x00:
            case 0x01:
            case 0x02:
            case 0x03:
            case 0x06:
            case 0x07:
                base = ModRM & 7;
                v_addr = Registers[base];
                break;
            case 0x08:
            case 0x09:
            case 0x0a:
            case 0x0b:
            case 0x0d:
            case 0x0e:
            case 0x0f:
                v_addr = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                base = ModRM & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                break;
            case 0x10:
            case 0x11:
            case 0x12:
            case 0x13:
            case 0x15:
            case 0x16:
            case 0x17:
            default:
                {
                    v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                base = ModRM & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                break;
            }
            return v_addr;
        } else if (Da & 0x0080) {
            if ((ModRM & 0xc7) == 0x06) {
                v_addr = Ob();
                Tb = 3;
            } else {
                switch (ModRM >> 6) {
                case 0:
                    v_addr = 0;
                    break;
                case 1:
                    v_addr = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    break;
                default:
                    v_addr = Ob();
                    break;
                }
                switch (ModRM & 7) {
                case 0:
                    v_addr = (v_addr + Registers[EBXIndex] + Registers[ESIIndex]) & 0xffff;
                    Tb = 3;
                    break;
                case 1:
                    v_addr = (v_addr + Registers[EBXIndex] + Registers[EDIIndex]) & 0xffff;
                    Tb = 3;
                    break;
                case 2:
                    v_addr = (v_addr + Registers[EBPIndex] + Registers[ESIIndex]) & 0xffff;
                    Tb = 2;
                    break;
                case 3:
                    v_addr = (v_addr + Registers[EBPIndex] + Registers[EDIIndex]) & 0xffff;
                    Tb = 2;
                    break;
                case 4:
                    v_addr = (v_addr + Registers[ESIIndex]) & 0xffff;
                    Tb = 3;
                    break;
                case 5:
                    v_addr = (v_addr + Registers[EDIIndex]) & 0xffff;
                    Tb = 3;
                    break;
                case 6:
                    v_addr = (v_addr + Registers[EBPIndex]) & 0xffff;
                    Tb = 2;
                    break;
                case 7:
                default:
                    v_addr = (v_addr + Registers[EBXIndex]) & 0xffff;
                    Tb = 3;
                    break;
                }
            }
            SegRegIndex = Da & 0x000f;
            if (SegRegIndex == 0) {
                SegRegIndex = Tb;
            } else {
                SegRegIndex--;
            }
            v_addr = (v_addr + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            return v_addr;
        } else {
            switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
            case 0x04:
                Qb = alias_phys_mem8[EIPDbyte++];;
                base = Qb & 7;
                if (base == 5) {
                    {
                        v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    };
                    base = 0;
                } else {
                    v_addr = Registers[base];
                }
                Rb = (Qb >> 3) & 7;
                if (Rb != 4) {
                    v_addr = (v_addr + (Registers[Rb] << (Qb >> 6))) >> 0;
                }
                break;
            case 0x0c:
                Qb = alias_phys_mem8[EIPDbyte++];;
                v_addr = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                base = Qb & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                Rb = (Qb >> 3) & 7;
                if (Rb != 4) {
                    v_addr = (v_addr + (Registers[Rb] << (Qb >> 6))) >> 0;
                }
                break;
            case 0x14:
                Qb = alias_phys_mem8[EIPDbyte++];; {
                    v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                base = Qb & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                Rb = (Qb >> 3) & 7;
                if (Rb != 4) {
                    v_addr = (v_addr + (Registers[Rb] << (Qb >> 6))) >> 0;
                }
                break;
            case 0x05:
                {
                    v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                base = 0;
                break;
            case 0x00:
            case 0x01:
            case 0x02:
            case 0x03:
            case 0x06:
            case 0x07:
                base = ModRM & 7;
                v_addr = Registers[base];
                break;
            case 0x08:
            case 0x09:
            case 0x0a:
            case 0x0b:
            case 0x0d:
            case 0x0e:
            case 0x0f:
                v_addr = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                base = ModRM & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                break;
            case 0x10:
            case 0x11:
            case 0x12:
            case 0x13:
            case 0x15:
            case 0x16:
            case 0x17:
            default:
                {
                    v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                base = ModRM & 7;
                v_addr = (v_addr + Registers[base]) >> 0;
                break;
            }
            SegRegIndex = Da & 0x000f;
            if (SegRegIndex == 0) {
                if (base == 4 || base == 5) SegRegIndex = 2;
                else SegRegIndex = 3;
            } else {
                SegRegIndex--;
            }
            v_addr = (v_addr + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            return v_addr;
        }
    }
    function SegRegisterIndexnerateIndirectAddressWithMoffset() {
        var v_addr, SegRegIndex;
        if (Da & 0x0080) {
            v_addr = Ob();
        } else {
            {
                v_addr = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                EIPDbyte += 4;
            };
        }
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        v_addr = (v_addr + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        return v_addr;
    }

    function UpdateAlOrAh(rm, data) {
        if (rm & 4) Registers[rm & 3] = (Registers[rm & 3] & -65281) | ((data & 0xff) << 8);
        else Registers[rm & 3] = (Registers[rm & 3] & -256) | (data & 0xff);
    }

    function UpdateAx(RegIndex, data) {
        Registers[RegIndex] = (Registers[RegIndex] & -65536) | (data & 0xffff);
    }
    function GroupCommand2(CommandIndex, OperandA, OperandB) {
        var carry;
        switch (CommandIndex) {
        case 0:
            SRC = OperandB;
            OperandA = (OperandA + OperandB) >> 0;
            ZeroFlag = OperandA;
            OP = 2;
            break;
        case 1:
            OperandA = OperandA | OperandB;
            ZeroFlag = OperandA;
            OP = 14;
            break;
        case 2:
            carry = CalculateCarry();
            SRC = OperandB;
            OperandA = (OperandA + OperandB + carry) >> 0;
            ZeroFlag = OperandA;
            OP = carry ? 5 : 2;
            break;
        case 3:
            carry = CalculateCarry();
            SRC = OperandB;
            OperandA = (OperandA - OperandB - carry) >> 0;
            ZeroFlag = OperandA;
            OP = carry ? 11 : 8;
            break;
        case 4:
            OperandA = OperandA & OperandB;
            ZeroFlag = OperandA;
            OP = 14;
            break;
        case 5:
            SRC = OperandB;
            OperandA = (OperandA - OperandB) >> 0;
            ZeroFlag = OperandA;
            OP = 8;
            break;
        case 6:
            OperandA = OperandA ^ OperandB;
            ZeroFlag = OperandA;
            OP = 14;
            break;
        case 7:
            SRC = OperandB;
            ZeroFlag = (OperandA - OperandB) >> 0;
            OP = 8;
            break;
        default:
            throw "arith" + cc + ": invalid op";
        }
        return OperandA;
    }
    function dc(CommandIndex, OperandA, OperandB) {
        var carry;
        switch (CommandIndex) {
        case 0:
            SRC = OperandB;
            OperandA = (((OperandA + OperandB) << 16) >> 16);
            ZeroFlag = OperandA;
            OP = 1;
            break;
        case 1:
            OperandA = (((OperandA | OperandB) << 16) >> 16);
            ZeroFlag = OperandA;
            OP = 13;
            break;
        case 2:
            carry = CalculateCarry();
            SRC = OperandB;
            OperandA = (((OperandA + OperandB + carry) << 16) >> 16);
            ZeroFlag = OperandA;
            OP = carry ? 4 : 1;
            break;
        case 3:
            carry = CalculateCarry();
            SRC = OperandB;
            OperandA = (((OperandA - OperandB - carry) << 16) >> 16);
            ZeroFlag = OperandA;
            OP = carry ? 10 : 7;
            break;
        case 4:
            OperandA = (((OperandA & OperandB) << 16) >> 16);
            ZeroFlag = OperandA;
            OP = 13;
            break;
        case 5:
            SRC = OperandB;
            OperandA = (((OperandA - OperandB) << 16) >> 16);
            ZeroFlag = OperandA;
            OP = 7;
            break;
        case 6:
            OperandA = (((OperandA ^ OperandB) << 16) >> 16);
            ZeroFlag = OperandA;
            OP = 13;
            break;
        case 7:
            SRC = OperandB;
            ZeroFlag = (((OperandA - OperandB) << 16) >> 16);
            OP = 7;
            break;
        default:
            throw "arith" + cc + ": invalid op";
        }
        return OperandA;
    }
    function ec(data) {
        if (OP < 25) {
            OP2 = OP;
            DST2 = ZeroFlag;
        }
        ZeroFlag = (((data + 1) << 16) >> 16);
        OP = 26;
        return ZeroFlag;
    }
    function fc(data) {
        if (OP < 25) {
            OP2 = OP;
            DST2 = ZeroFlag;
        }
        ZeroFlag = (((data - 1) << 16) >> 16);
        OP = 29;
        return ZeroFlag;
    }
    function GroupCommand(CommandIndex, OperandA, OperandB) {
        var carry;
        switch (CommandIndex) {
        case 0:
            SRC = OperandB;
            OperandA = (((OperandA + OperandB) << 24) >> 24);
            ZeroFlag = OperandA;
            OP = 0;
            break;
        case 1:
            OperandA = (((OperandA | OperandB) << 24) >> 24);
            ZeroFlag = OperandA;
            OP = 12;
            break;
        case 2:
            carry = CalculateCarry();
            SRC = OperandB;
            OperandA = (((OperandA + OperandB + carry) << 24) >> 24);
            ZeroFlag = OperandA;
            OP = carry ? 3 : 0;
            break;
        case 3:
            carry = CalculateCarry();
            SRC = OperandB;
            OperandA = (((OperandA - OperandB - carry) << 24) >> 24);
            ZeroFlag = OperandA;
            OP = carry ? 9 : 6;
            break;
        case 4:
            OperandA = (((OperandA & OperandB) << 24) >> 24);
            ZeroFlag = OperandA;
            OP = 12;
            break;
        case 5:
            SRC = OperandB;
            OperandA = (((OperandA - OperandB) << 24) >> 24);
            ZeroFlag = OperandA;
            OP = 6;
            break;
        case 6:
            OperandA = (((OperandA ^ OperandB) << 24) >> 24);
            ZeroFlag = OperandA;
            OP = 12;
            break;
        case 7:
            SRC = OperandB;
            ZeroFlag = (((OperandA - OperandB) << 24) >> 24);
            OP = 6;
            break;
        default:
            throw "arith" + cc + ": invalid op";
        }
        return OperandA;
    }
    function hc(data) {
        if (OP < 25) {
            OP2 = OP;
            DST2 = ZeroFlag;
        }
        ZeroFlag = (((data + 1) << 24) >> 24);
        OP = 25;
        return ZeroFlag;
    }
    function ic(data) {
        if (OP < 25) {
            OP2 = OP;
            DST2 = ZeroFlag;
        }
        ZeroFlag = (((data - 1) << 24) >> 24);
        OP = 28;
        return ZeroFlag;
    }
    function jc(CommandIndex, OperandA, OperandB) {
        var kc, carry;
        switch (CommandIndex) {
        case 0:
            if (OperandB & 0x1f) {
                OperandB &= 0x7;
                OperandA &= 0xff;
                kc = OperandA;
                OperandA = (OperandA << OperandB) | (OperandA >>> (8 - OperandB));
                SRC = lc();
                SRC |= (OperandA & 0x0001) | (((kc ^ OperandA) << 4) & 0x0800);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 1:
            if (OperandB & 0x1f) {
                OperandB &= 0x7;
                OperandA &= 0xff;
                kc = OperandA;
                OperandA = (OperandA >>> OperandB) | (OperandA << (8 - OperandB));
                SRC = lc();
                SRC |= ((OperandA >> 7) & 0x0001) | (((kc ^ OperandA) << 4) & 0x0800);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 2:
            OperandB = one_F_mask2[OperandB & 0x1f];
            if (OperandB) {
                OperandA &= 0xff;
                kc = OperandA;
                carry = CalculateCarry();
                OperandA = (OperandA << OperandB) | (carry << (OperandB - 1));
                if (OperandB > 1) OperandA |= kc >>> (9 - OperandB);
                SRC = lc();
                SRC |= (((kc ^ OperandA) << 4) & 0x0800) | ((kc >> (8 - OperandB)) & 0x0001);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 3:
            OperandB = one_F_mask2[OperandB & 0x1f];
            if (OperandB) {
                OperandA &= 0xff;
                kc = OperandA;
                carry = CalculateCarry();
                OperandA = (OperandA >>> OperandB) | (carry << (8 - OperandB));
                if (OperandB > 1) OperandA |= kc << (9 - OperandB);
                SRC = lc();
                SRC |= (((kc ^ OperandA) << 4) & 0x0800) | ((kc >> (OperandB - 1)) & 0x0001);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 4:
        case 6:
            OperandB &= 0x1f;
            if (OperandB) {
                SRC = OperandA << (OperandB - 1);
                ZeroFlag = OperandA = (((OperandA << OperandB) << 24) >> 24);
                OP = 15;
            }
            break;
        case 5:
            OperandB &= 0x1f;
            if (OperandB) {
                OperandA &= 0xff;
                SRC = OperandA >>> (OperandB - 1);
                ZeroFlag = OperandA = (((OperandA >>> OperandB) << 24) >> 24);
                OP = 18;
            }
            break;
        case 7:
            OperandB &= 0x1f;
            if (OperandB) {
                OperandA = (OperandA << 24) >> 24;
                SRC = OperandA >> (OperandB - 1);
                ZeroFlag = OperandA = (((OperandA >> OperandB) << 24) >> 24);
                OP = 18;
            }
            break;
        default:
            throw "unsupported shift8=" + CommandIndex;
        }
        return OperandA;
    }
    function mc(CommandIndex, OperandA, OperandB) {
        var kc, carry;
        switch (CommandIndex) {
        case 0:
            if (OperandB & 0x1f) {
                OperandB &= 0xf;
                OperandA &= 0xffff;
                kc = OperandA;
                OperandA = (OperandA << OperandB) | (OperandA >>> (16 - OperandB));
                SRC = lc();
                SRC |= (OperandA & 0x0001) | (((kc ^ OperandA) >> 4) & 0x0800);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 1:
            if (OperandB & 0x1f) {
                OperandB &= 0xf;
                OperandA &= 0xffff;
                kc = OperandA;
                OperandA = (OperandA >>> OperandB) | (OperandA << (16 - OperandB));
                SRC = lc();
                SRC |= ((OperandA >> 15) & 0x0001) | (((kc ^ OperandA) >> 4) & 0x0800);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 2:
            OperandB = one_F_mask[OperandB & 0x1f];
            if (OperandB) {
                OperandA &= 0xffff;
                kc = OperandA;
                carry = CalculateCarry();
                OperandA = (OperandA << OperandB) | (carry << (OperandB - 1));
                if (OperandB > 1) OperandA |= kc >>> (17 - OperandB);
                SRC = lc();
                SRC |= (((kc ^ OperandA) >> 4) & 0x0800) | ((kc >> (16 - OperandB)) & 0x0001);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 3:
            OperandB = one_F_mask[OperandB & 0x1f];
            if (OperandB) {
                OperandA &= 0xffff;
                kc = OperandA;
                carry = CalculateCarry();
                OperandA = (OperandA >>> OperandB) | (carry << (16 - OperandB));
                if (OperandB > 1) OperandA |= kc << (17 - OperandB);
                SRC = lc();
                SRC |= (((kc ^ OperandA) >> 4) & 0x0800) | ((kc >> (OperandB - 1)) & 0x0001);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 4:
        case 6:
            OperandB &= 0x1f;
            if (OperandB) {
                SRC = OperandA << (OperandB - 1);
                ZeroFlag = OperandA = (((OperandA << OperandB) << 16) >> 16);
                OP = 16;
            }
            break;
        case 5:
            OperandB &= 0x1f;
            if (OperandB) {
                OperandA &= 0xffff;
                SRC = OperandA >>> (OperandB - 1);
                ZeroFlag = OperandA = (((OperandA >>> OperandB) << 16) >> 16);
                OP = 19;
            }
            break;
        case 7:
            OperandB &= 0x1f;
            if (OperandB) {
                OperandA = (OperandA << 16) >> 16;
                SRC = OperandA >> (OperandB - 1);
                ZeroFlag = OperandA = (((OperandA >> OperandB) << 16) >> 16);
                OP = 19;
            }
            break;
        default:
            throw "unsupported shift16=" + CommandIndex;
        }
        return OperandA;
    }
    function nc(CommandIndex, OperandA, OperandB) {
        var kc, carry;
        switch (CommandIndex) {
        case 0:
            OperandB &= 0x1f;
            if (OperandB) {
                kc = OperandA;
                OperandA = (OperandA << OperandB) | (OperandA >>> (32 - OperandB));
                SRC = lc();
                SRC |= (OperandA & 0x0001) | (((kc ^ OperandA) >> 20) & 0x0800);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 1:
            OperandB &= 0x1f;
            if (OperandB) {
                kc = OperandA;
                OperandA = (OperandA >>> OperandB) | (OperandA << (32 - OperandB));
                SRC = lc();
                SRC |= ((OperandA >> 31) & 0x0001) | (((kc ^ OperandA) >> 20) & 0x0800);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 2:
            OperandB &= 0x1f;
            if (OperandB) {
                kc = OperandA;
                carry = CalculateCarry();
                OperandA = (OperandA << OperandB) | (carry << (OperandB - 1));
                if (OperandB > 1) OperandA |= kc >>> (33 - OperandB);
                SRC = lc();
                SRC |= (((kc ^ OperandA) >> 20) & 0x0800) | ((kc >> (32 - OperandB)) & 0x0001);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 3:
            OperandB &= 0x1f;
            if (OperandB) {
                kc = OperandA;
                carry = CalculateCarry();
                OperandA = (OperandA >>> OperandB) | (carry << (32 - OperandB));
                if (OperandB > 1) OperandA |= kc << (33 - OperandB);
                SRC = lc();
                SRC |= (((kc ^ OperandA) >> 20) & 0x0800) | ((kc >> (OperandB - 1)) & 0x0001);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
            }
            break;
        case 4:
        case 6:
            OperandB &= 0x1f;
            if (OperandB) {
                SRC = OperandA << (OperandB - 1);
                ZeroFlag = OperandA = OperandA << OperandB;
                OP = 17;
            }
            break;
        case 5:
            OperandB &= 0x1f;
            if (OperandB) {
                SRC = OperandA >>> (OperandB - 1);
                ZeroFlag = OperandA = OperandA >>> OperandB;
                OP = 20;
            }
            break;
        case 7:
            OperandB &= 0x1f;
            if (OperandB) {
                SRC = OperandA >> (OperandB - 1);
                ZeroFlag = OperandA = OperandA >> OperandB;
                OP = 20;
            }
            break;
        default:
            throw "unsupported shift32=" + CommandIndex;
        }
        return OperandA;
    }
    function oc(CommandIndex, OperandA, OperandB, pc) {
        var Result;
        pc &= 0x1f;
        if (pc) {
            if (CommandIndex == 0) {
                OperandB &= 0xffff;
                Result = OperandB | (OperandA << 16);
                SRC = Result >> (32 - pc);
                Result <<= pc;
                if (pc > 16) Result |= OperandB << (pc - 16);
                OperandA = ZeroFlag = Result >> 16;
                OP = 19;
            } else {
                Result = (OperandA & 0xffff) | (OperandB << 16);
                SRC = Result >> (pc - 1);
                Result >>= pc;
                if (pc > 16) Result |= OperandB << (32 - pc);
                OperandA = ZeroFlag = (((Result) << 16) >> 16);
                OP = 19;
            }
        }
        return OperandA;
    }
    function rc(OperandA, OperandB, pc) {
        pc &= 0x1f;
        if (pc) {
            SRC = OperandA << (pc - 1);
            ZeroFlag = OperandA = (OperandA << pc) | (OperandB >>> (32 - pc));
            OP = 17;
        }
        return OperandA;
    }
    function sc(OperandA, OperandB, pc) {
        pc &= 0x1f;
        if (pc) {
            SRC = OperandA >> (pc - 1);
            ZeroFlag = OperandA = (OperandA >>> pc) | (OperandB << (32 - pc));
            OP = 20;
        }
        return OperandA;
    }
    function tc(OperandA, OperandB) {
        OperandB &= 0xf;
        SRC = OperandA >> OperandB;
        OP = 19;
    }
    function uc(OperandA, OperandB) {
        OperandB &= 0x1f;
        SRC = OperandA >> OperandB;
        OP = 20;
    }
    function vc(CommandIndex, OperandA, OperandB) {
        var wc;
        OperandB &= 0xf;
        SRC = OperandA >> OperandB;
        wc = 1 << OperandB;
        switch (CommandIndex) {
        case 1:
            OperandA |= wc;
            break;
        case 2:
            OperandA &= ~wc;
            break;
        case 3:
        default:
            OperandA ^= wc;
            break;
        }
        OP = 19;
        return OperandA;
    }
    function xc(CommandIndex, OperandA, OperandB) {
        var wc;
        OperandB &= 0x1f;
        SRC = OperandA >> OperandB;
        wc = 1 << OperandB;
        switch (CommandIndex) {
        case 1:
            OperandA |= wc;
            break;
        case 2:
            OperandA &= ~wc;
            break;
        case 3:
        default:
            OperandA ^= wc;
            break;
        }
        OP = 20;
        return OperandA;
    }
    function yc(OperandA, OperandB) {
        OperandB &= 0xffff;
        if (OperandB) {
            OperandA = 0;
            while ((OperandB & 1) == 0) {
                OperandA++;
                OperandB >>= 1;
            }
            ZeroFlag = 1;
        } else {
            ZeroFlag = 0;
        }
        OP = 14;
        return OperandA;
    }
    function zc(OperandA, OperandB) {
        if (OperandB) {
            OperandA = 0;
            while ((OperandB & 1) == 0) {
                OperandA++;
                OperandB >>= 1;
            }
            ZeroFlag = 1;
        } else {
            ZeroFlag = 0;
        }
        OP = 14;
        return OperandA;
    }
    function Ac(OperandA, OperandB) {
        OperandB &= 0xffff;
        if (OperandB) {
            OperandA = 15;
            while ((OperandB & 0x8000) == 0) {
                OperandA--;
                OperandB <<= 1;
            }
            ZeroFlag = 1;
        } else {
            ZeroFlag = 0;
        }
        OP = 14;
        return OperandA;
    }
    function Bc(OperandA, OperandB) {
        if (OperandB) {
            OperandA = 31;
            while (OperandB >= 0) {
                OperandA--;
                OperandB <<= 1;
            }
            ZeroFlag = 1;
        } else {
            ZeroFlag = 0;
        }
        OP = 14;
        return OperandA;
    }
    function UnsignedShortDivide(divisor) {
        var dividend, quotient, remainder;
        dividend = Registers[EAXIndex] & 0xffff;
        divisor &= 0xff;
        if ((dividend >> 8) >= divisor) Interrupt(0);
        quotient = (dividend / divisor) >> 0;
        remainder = (dividend % divisor);
        UpdateAx(EAXIndex, (quotient & 0xff) | (remainder << 8));
    }
    function SignedShortDivide(divisor) {
        var dividend, quotient, remainder;
        dividend = (Registers[EAXIndex] << 16) >> 16;
        divisor = (divisor << 24) >> 24;
        if (divisor == 0) Interrupt(0);
        quotient = (dividend / divisor) >> 0;
        if (((quotient << 24) >> 24) != quotient) Interrupt(0);
        remainder = (dividend % divisor);
        UpdateAx(EAXIndex, (quotient & 0xff) | (remainder << 8));
    }
    function UnsignedIntDivide(divisor) {
        var dividend, quotient, remainder;
        dividend = (Registers[EDXIndex] << 16) | (Registers[EAXIndex] & 0xffff);
        divisor &= 0xffff;
        if ((dividend >>> 16) >= divisor) Interrupt(0);
        quotient = (dividend / divisor) >> 0;
        remainder = (dividend % divisor);
        UpdateAx(EAXIndex, quotient);
        UpdateAx(EDXIndex, remainder);
    }
    function SignedIntDivide(divisor) {
        var dividend, quotient, remainder;
        dividend = (Registers[EDXIndex] << 16) | (Registers[EAXIndex] & 0xffff);
        divisor = (divisor << 16) >> 16;
        if (divisor == 0) Interrupt(0);
        quotient = (dividend / divisor) >> 0;
        if (((quotient << 16) >> 16) != quotient) Interrupt(0);
        remainder = (dividend % divisor);
        UpdateAx(EAXIndex, quotient);
        UpdateAx(EDXIndex, remainder);
    }
    function UnsignedInt64Divide(HighWord, LowWord, divisor) {
		var dividend, i, Kc;
        HighWord = HighWord >>> 0;
        LowWord = LowWord >>> 0;
        divisor = divisor >>> 0;
        if (HighWord >= divisor) {
            Interrupt(0);
        }

		//strange check, even if we don't check it, the code still work
        if (HighWord >= 0 && HighWord <= 0x200000) {
            dividend = HighWord * 4294967296 + LowWord;
            ExtrsPartResult = (dividend % divisor) >> 0;
            return (dividend / divisor) >> 0;
        } else {
			//please ignore the following code, it seems like a backdoor
            for (i = 0; i < 32; i++) {
                Kc = HighWord >> 31;
                HighWord = ((HighWord << 1) | (LowWord >>> 31)) >>> 0;
                if (Kc || HighWord >= divisor) {
                    HighWord = HighWord - divisor;
                    LowWord = (LowWord << 1) | 1;
                } else {
                    LowWord = LowWord << 1;
                }
            }
            ExtrsPartResult = HighWord >> 0;
			console.log("result=" + LowWord);
            return LowWord;
        }
    }
    function SignedInt64Divide(HighWord, LowWord, divisor) {
        var SignOfDividend, SignOfDivisor, quotient;
        if (HighWord < 0) {
            SignOfDividend = 1;
            HighWord = ~HighWord;
            LowWord = ( - LowWord) >> 0;
            if (LowWord == 0) HighWord = (HighWord + 1) >> 0;
        } else {
            SignOfDividend = 0;
        }
        if (divisor < 0) {
            divisor = ( - divisor) >> 0;
            SignOfDivisor = 1;
        } else {
            SignOfDivisor = 0;
        }
        quotient = UnsignedInt64Divide(HighWord, LowWord, divisor);
        SignOfDivisor ^= SignOfDividend;
        if (SignOfDivisor) {
            if ((quotient >>> 0) > 0x80000000) Interrupt(0);
            quotient = ( - quotient) >> 0;
        } else {
            if ((quotient >>> 0) >= 0x80000000) Interrupt(0);
        }
        if (SignOfDividend) {
            ExtrsPartResult = ( - ExtrsPartResult) >> 0;
        }
        return quotient;
    }
    function Oc(OperandA, param) {
        var Result;
        OperandA &= 0xff;
        param &= 0xff;
        Result = (Registers[EAXIndex] & 0xff) * (param & 0xff);
        SRC = Result >> 8;
        ZeroFlag = (((Result) << 24) >> 24);
        OP = 21;
        return Result;
    }
    function Pc(OperandA, param) {
        var Result;
        OperandA = (((OperandA) << 24) >> 24);
        param = (((param) << 24) >> 24);
        Result = (OperandA * param) >> 0;
        ZeroFlag = (((Result) << 24) >> 24);
        SRC = (Result != ZeroFlag) >> 0;
        OP = 21;
        return Result;
    }
    function Qc(OperandA, param) {
        var Result;
        Result = ((OperandA & 0xffff) * (param & 0xffff)) >> 0;
        SRC = Result >>> 16;
        ZeroFlag = (((Result) << 16) >> 16);
        OP = 22;
        return Result;
    }
    function Rc(OperandA, param) {
        var Result;
        OperandA = (OperandA << 16) >> 16;
        param = (param << 16) >> 16;
        Result = (OperandA * param) >> 0;
        ZeroFlag = (((Result) << 16) >> 16);
        SRC = (Result != ZeroFlag) >> 0;
        OP = 22;
        return Result;
    }
    function UnsignedMul(OperandA, OperandB) {
        var Result, LowWordA, HighWordA, LowWordB, HighWordB, m;
        OperandA = OperandA >>> 0;
        OperandB = OperandB >>> 0;
        Result = OperandA * OperandB;
        if (Result <= 0xffffffff) {
            ExtrsPartResult = 0;
            Result &= -1;
        } else {
            LowWordA = OperandA & 0xffff;
            HighWordA = OperandA >>> 16;
            LowWordB = OperandB & 0xffff;
            HighWordB = OperandB >>> 16;
            Result = LowWordA * LowWordB;
            ExtrsPartResult = HighWordA * HighWordB;
            m = LowWordA * HighWordB;
            Result += (((m & 0xffff) << 16) >>> 0);
            ExtrsPartResult += (m >>> 16);
            if (Result >= 4294967296) {
                Result -= 4294967296;
                ExtrsPartResult++;
            }
            m = HighWordA * LowWordB;
            Result += (((m & 0xffff) << 16) >>> 0);
            ExtrsPartResult += (m >>> 16);
            if (Result >= 4294967296) {
                Result -= 4294967296;
                ExtrsPartResult++;
            }
            Result &= -1;
            ExtrsPartResult &= -1;
        }
        return Result;
    }
    function UnsignedMulWrapper(OperandA, OperandB) {
        ZeroFlag = UnsignedMul(OperandA, OperandB);
        SRC = ExtrsPartResult;
        OP = 23;
        return ZeroFlag;
    }
    function SignedMul(OperandA, OperandB) {
        var Signed, Result;
        Signed = 0;
        if (OperandA < 0) {
            OperandA = -OperandA;
            Signed = 1;
        }
        if (OperandB < 0) {
            OperandB = -OperandB;
            Signed ^= 1;
        }
        Result = UnsignedMul(OperandA, OperandB);
        if (Signed) {
            ExtrsPartResult = ~ExtrsPartResult;
            Result = ( - Result) >> 0;
            if (Result == 0) {
                ExtrsPartResult = (ExtrsPartResult + 1) >> 0;
            }
        }
        ZeroFlag = Result;
        SRC = (ExtrsPartResult - (Result >> 31)) >> 0;
        OP = 23;
        return Result;
    }

    function CalculateCarry() {
        var Temp, Result, OpCode, DST;
        if (OP >= 25) {
            OpCode = OP2;
            DST = DST2;
        } else {
            OpCode = OP;
            DST = ZeroFlag;
        }
        switch (OpCode) {
        case 0:
            Result = (DST & 0xff) < (SRC & 0xff);
            break;
        case 1:
            Result = (DST & 0xffff) < (SRC & 0xffff);
            break;
        case 2:
            Result = (DST >>> 0) < (SRC >>> 0);
            break;
        case 3:
            Result = (DST & 0xff) <= (SRC & 0xff);
            break;
        case 4:
            Result = (DST & 0xffff) <= (SRC & 0xffff);
            break;
        case 5:
            Result = (DST >>> 0) <= (SRC >>> 0);
            break;
        case 6:
            Result = ((DST + SRC) & 0xff) < (SRC & 0xff);
            break;
        case 7:
            Result = ((DST + SRC) & 0xffff) < (SRC & 0xffff);
            break;
        case 8:
            Result = ((DST + SRC) >>> 0) < (SRC >>> 0);
            break;
        case 9:
            Temp = (DST + SRC + 1) & 0xff;
            Result = Temp <= (SRC & 0xff);
            break;
        case 10:
            Temp = (DST + SRC + 1) & 0xffff;
            Result = Temp <= (SRC & 0xffff);
            break;
        case 11:
            Temp = (DST + SRC + 1) >>> 0;
            Result = Temp <= (SRC >>> 0);
            break;
        case 12:
        case 13:
        case 14:
            Result = 0;
            break;
        case 15:
            Result = (SRC >> 7) & 1;
            break;
        case 16:
            Result = (SRC >> 15) & 1;
            break;
        case 17:
            Result = (SRC >> 31) & 1;
            break;
        case 18:
        case 19:
        case 20:
            Result = SRC & 1;
            break;
        case 21:
        case 22:
        case 23:
            Result = SRC != 0;
            break;
        case 24:
            Result = SRC & 1;
            break;
        default:
            throw "GET_CARRY: unsupported cc_op=" + OP;
        }
        return Result;
    }

    function CheckOverFlow() {
        var Result, Operand;
        switch (OP) {
        case 0:
            Operand = (ZeroFlag - SRC) >> 0;
            Result = (((Operand ^ SRC ^ -1) & (Operand ^ ZeroFlag)) >> 7) & 1;
            break;
        case 1:
            Operand = (ZeroFlag - SRC) >> 0;
            Result = (((Operand ^ SRC ^ -1) & (Operand ^ ZeroFlag)) >> 15) & 1;
            break;
        case 2:
            Operand = (ZeroFlag - SRC) >> 0;
            Result = (((Operand ^ SRC ^ -1) & (Operand ^ ZeroFlag)) >> 31) & 1;
            break;
        case 3:
            Operand = (ZeroFlag - SRC - 1) >> 0;
            Result = (((Operand ^ SRC ^ -1) & (Operand ^ ZeroFlag)) >> 7) & 1;
            break;
        case 4:
            Operand = (ZeroFlag - SRC - 1) >> 0;
            Result = (((Operand ^ SRC ^ -1) & (Operand ^ ZeroFlag)) >> 15) & 1;
            break;
        case 5:
            Operand = (ZeroFlag - SRC - 1) >> 0;
            Result = (((Operand ^ SRC ^ -1) & (Operand ^ ZeroFlag)) >> 31) & 1;
            break;
        case 6:
            Operand = (ZeroFlag + SRC) >> 0;
            Result = (((Operand ^ SRC) & (Operand ^ ZeroFlag)) >> 7) & 1;
            break;
        case 7:
            Operand = (ZeroFlag + SRC) >> 0;
            Result = (((Operand ^ SRC) & (Operand ^ ZeroFlag)) >> 15) & 1;
            break;
        case 8:
            Operand = (ZeroFlag + SRC) >> 0;
            Result = (((Operand ^ SRC) & (Operand ^ ZeroFlag)) >> 31) & 1;
            break;
        case 9:
            Operand = (ZeroFlag + SRC + 1) >> 0;
            Result = (((Operand ^ SRC) & (Operand ^ ZeroFlag)) >> 7) & 1;
            break;
        case 10:
            Operand = (ZeroFlag + SRC + 1) >> 0;
            Result = (((Operand ^ SRC) & (Operand ^ ZeroFlag)) >> 15) & 1;
            break;
        case 11:
            Operand = (ZeroFlag + SRC + 1) >> 0;
            Result = (((Operand ^ SRC) & (Operand ^ ZeroFlag)) >> 31) & 1;
            break;
        case 12:
        case 13:
        case 14:
            Result = 0;
            break;
        case 15:
        case 18:
            Result = ((SRC ^ ZeroFlag) >> 7) & 1;
            break;
        case 16:
        case 19:
            Result = ((SRC ^ ZeroFlag) >> 15) & 1;
            break;
        case 17:
        case 20:
            Result = ((SRC ^ ZeroFlag) >> 31) & 1;
            break;
        case 21:
        case 22:
        case 23:
            Result = SRC != 0;
            break;
        case 24:
            Result = (SRC >> 11) & 1;
            break;
        case 25:
            Result = (ZeroFlag & 0xff) == 0x80;
            break;
        case 26:
            Result = (ZeroFlag & 0xffff) == 0x8000;
            break;
        case 27:
            Result = (ZeroFlag == -2147483648);
            break;
        case 28:
            Result = (ZeroFlag & 0xff) == 0x7f;
            break;
        case 29:
            Result = (ZeroFlag & 0xffff) == 0x7fff;
            break;
        case 30:
            Result = ZeroFlag == 0x7fffffff;
            break;
        default:
            throw "JO: unsupported cc_op=" + OP;
        }
        return Result;
    }

    function CalculateCarryOrZeroFlag() {
        var Result;
        switch (OP) {
        case 6:
            Result = ((ZeroFlag + SRC) & 0xff) <= (SRC & 0xff);
            break;
        case 7:
            Result = ((ZeroFlag + SRC) & 0xffff) <= (SRC & 0xffff);
            break;
        case 8:
            Result = ((ZeroFlag + SRC) >>> 0) <= (SRC >>> 0);
            break;
        case 24:
            Result = (SRC & (0x0040 | 0x0001)) != 0;
            break;
        default:
            Result = CalculateCarry() | (ZeroFlag == 0);
            break;
        }
        return Result;
    }

    function CalculateParity() {
        if (OP == 24) {
            return (SRC >> 2) & 1;
        } else {
            return parity_table[ZeroFlag & 0xff];
        }
    }
    function cd() {
        var Result;
        switch (OP) {
        case 6:
            Result = ((ZeroFlag + SRC) << 24) < (SRC << 24);
            break;
        case 7:
            Result = ((ZeroFlag + SRC) << 16) < (SRC << 16);
            break;
        case 8:
            Result = ((ZeroFlag + SRC) >> 0) < SRC;
            break;
        case 12:
        case 25:
        case 28:
        case 13:
        case 26:
        case 29:
        case 14:
        case 27:
        case 30:
            Result = ZeroFlag < 0;
            break;
        case 24:
            Result = ((SRC >> 7) ^ (SRC >> 11)) & 1;
            break;
        default:
            Result = (OP == 24 ? ((SRC >> 7) & 1) : (ZeroFlag < 0)) ^ CheckOverFlow();
            break;
        }
        return Result;
    }
    function dd() {
        var Result;
        switch (OP) {
        case 6:
            Result = ((ZeroFlag + SRC) << 24) <= (SRC << 24);
            break;
        case 7:
            Result = ((ZeroFlag + SRC) << 16) <= (SRC << 16);
            break;
        case 8:
            Result = ((ZeroFlag + SRC) >> 0) <= SRC;
            break;
        case 12:
        case 25:
        case 28:
        case 13:
        case 26:
        case 29:
        case 14:
        case 27:
        case 30:
            Result = ZeroFlag <= 0;
            break;
        case 24:
            Result = (((SRC >> 7) ^ (SRC >> 11)) | (SRC >> 6)) & 1;
            break;
        default:
            Result = ((OP == 24 ? ((SRC >> 7) & 1) : (ZeroFlag < 0)) ^ CheckOverFlow()) | (ZeroFlag == 0);
            break;
        }
        return Result;
    }
    function ed() {
        var Operand, Result;
        switch (OP) {
        case 0:
        case 1:
        case 2:
            Operand = (ZeroFlag - SRC) >> 0;
            Result = (ZeroFlag ^ Operand ^ SRC) & 0x10;
            break;
        case 3:
        case 4:
        case 5:
            Operand = (ZeroFlag - SRC - 1) >> 0;
            Result = (ZeroFlag ^ Operand ^ SRC) & 0x10;
            break;
        case 6:
        case 7:
        case 8:
            Operand = (ZeroFlag + SRC) >> 0;
            Result = (ZeroFlag ^ Operand ^ SRC) & 0x10;
            break;
        case 9:
        case 10:
        case 11:
            Operand = (ZeroFlag + SRC + 1) >> 0;
            Result = (ZeroFlag ^ Operand ^ SRC) & 0x10;
            break;
        case 12:
        case 13:
        case 14:
            Result = 0;
            break;
        case 15:
        case 18:
        case 16:
        case 19:
        case 17:
        case 20:
        case 21:
        case 22:
        case 23:
            Result = 0;
            break;
        case 24:
            Result = SRC & 0x10;
            break;
        case 25:
        case 26:
        case 27:
            Result = (ZeroFlag ^ (ZeroFlag - 1)) & 0x10;
            break;
        case 28:
        case 29:
        case 30:
            Result = (ZeroFlag ^ (ZeroFlag + 1)) & 0x10;
            break;
        default:
            throw "AF: unsupported cc_op=" + OP;
        }
        return Result;
    }
    function fd(gd) {
        var Result;
        switch (gd >> 1) {
        case 0:
            Result = CheckOverFlow();
            break;
        case 1:
            Result = CalculateCarry();
            break;
        case 2:
            Result = (ZeroFlag == 0);
            break;
        case 3:
            Result = CalculateCarryOrZeroFlag();
            break;
        case 4:
            Result = (OP == 24 ? ((SRC >> 7) & 1) : (ZeroFlag < 0));
            break;
        case 5:
            Result = CalculateParity();
            break;
        case 6:
            Result = cd();
            break;
        case 7:
            Result = dd();
            break;
        default:
            throw "unsupported cond: " + gd;
        }
        return Result ^ (gd & 1);
    }
    function lc() {
        return (CalculateParity() << 2) | ((ZeroFlag == 0) << 6) | ((OP == 24 ? ((SRC >> 7) & 1) : (ZeroFlag < 0)) << 7) | ed();
    }
    function CalculateEFL() {
        return (CalculateCarry() << 0) | (CalculateParity() << 2) | ((ZeroFlag == 0) << 6) | ((OP == 24 ? ((SRC >> 7) & 1) : (ZeroFlag < 0)) << 7) | (CheckOverFlow() << 11) | ed();
    }
    function id() {
        var jd;
        jd = CalculateEFL();
        jd |= alias_CPU_X86.df & 0x00000400;
        jd |= alias_CPU_X86.eflags;
        return jd;
    }
    function kd(jd, ld) {
        SRC = jd & (0x0800 | 0x0080 | 0x0040 | 0x0010 | 0x0004 | 0x0001);
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
        alias_CPU_X86.df = 1 - (2 * ((jd >> 10) & 1));
        alias_CPU_X86.eflags = (alias_CPU_X86.eflags & ~ld) | (jd & ld);
    }
    function md() {
        return alias_CPU_X86.cycle_count + (ua - Ka);
    }
    function nd(na) {
        throw "CPU abort: " + na;
    }
    function od() {
        alias_CPU_X86.eip = EIPDword;
        alias_CPU_X86.cc_src = SRC;
        alias_CPU_X86.cc_dst = ZeroFlag;
        alias_CPU_X86.cc_op = OP;
        alias_CPU_X86.cc_op2 = OP2;
        alias_CPU_X86.cc_dst2 = DST2;
        alias_CPU_X86.dump();
    }
    function pd() {
        alias_CPU_X86.eip = EIPDword;
        alias_CPU_X86.cc_src = SRC;
        alias_CPU_X86.cc_dst = ZeroFlag;
        alias_CPU_X86.cc_op = OP;
        alias_CPU_X86.cc_op2 = OP2;
        alias_CPU_X86.cc_dst2 = DST2;
        alias_CPU_X86.dump_short();
    }
    function interuption(intno, error_code) {
        alias_CPU_X86.cycle_count += (ua - Ka);
        alias_CPU_X86.eip = EIPDword;
        alias_CPU_X86.cc_src = SRC;
        alias_CPU_X86.cc_dst = ZeroFlag;
        alias_CPU_X86.cc_op = OP;
        alias_CPU_X86.cc_op2 = OP2;
        alias_CPU_X86.cc_dst2 = DST2;
        throw {
            intno: intno,
            error_code: error_code
        };
    }
    function Interrupt(intno) {
        interuption(intno, 0);
    }
    function rd(sd) {
        alias_CPU_X86.cpl = sd;
        if (alias_CPU_X86.cpl == 3) {
            alias_tlb_read = alias_tlb_read_user;
            alias_tlb_write = alias_tlb_write_user;
        } else {
            alias_tlb_read = alias_tlb_read_kernel;
            alias_tlb_write = alias_tlb_write_kernel;
        }
    }
    function td(v_addr, ud) {
        var temp;
        if (ud) {
            temp = alias_tlb_write[v_addr >>> 12];
        } else {
            temp = alias_tlb_read[v_addr >>> 12];
        }
        if (temp == -1) {
            LoadMissingVaddrIntoPageTable(v_addr, ud, alias_CPU_X86.cpl == 3);
            if (ud) {
                temp = alias_tlb_write[v_addr >>> 12];
            } else {
                temp = alias_tlb_read[v_addr >>> 12];
            }
        }
        return temp ^ v_addr;
    }
    function vd(data) {
        var wd;
        wd = Registers[ESPIndex] - 2;
        v_addr = ((wd & Pa) + Oa) >> 0;
        WriteShortToVaddr(data);
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((wd) & Pa);
    }
    function xd(data) {
        var wd;
        wd = Registers[ESPIndex] - 4;
        v_addr = ((wd & Pa) + Oa) >> 0;
        WriteIntToVaddr(data);
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((wd) & Pa);
    }
    function yd() {
        v_addr = ((Registers[ESPIndex] & Pa) + Oa) >> 0;
        return ReadShortFromVaddrReadOnly();
    }
    function zd() {
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Registers[ESPIndex] + 2) & Pa);
    }
    function Ad() {
        v_addr = ((Registers[ESPIndex] & Pa) + Oa) >> 0;
        return ReadIntFromVaddrReadOnly();
    }
    function Bd() {
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Registers[ESPIndex] + 4) & Pa);
    }
    function Cd(Nb, param) {
        var n, Da, l, ModRM, Dd, base, CommandIndex, Ed;
        n = 1;
        Da = Ra;
        if (Da & 0x0100) Ed = 2;
        else Ed = 4;
        Start: for (;;) {
            switch (param) {
            case 0x66:
                if (Ra & 0x0100) {
                    Ed = 4;
                    Da &= ~0x0100;
                } else {
                    Ed = 2;
                    Da |= 0x0100;
                }
            case 0xf0:
            case 0xf2:
            case 0xf3:
            case 0x26:
            case 0x2e:
            case 0x36:
            case 0x3e:
            case 0x64:
            case 0x65:
                {
                    if ((n + 1) > 15) Interrupt(6);
                    v_addr = (Nb + (n++)) >> 0;
                    param = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                };
                break;
            case 0x67:
                if (Ra & 0x0080) {
                    Da &= ~0x0080;
                } else {
                    Da |= 0x0080;
                } {
                    if ((n + 1) > 15) Interrupt(6);
                    v_addr = (Nb + (n++)) >> 0;
                    param = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                };
                break;
            case 0x91:
            case 0x92:
            case 0x93:
            case 0x94:
            case 0x95:
            case 0x96:
            case 0x97:
            case 0x40:
            case 0x41:
            case 0x42:
            case 0x43:
            case 0x44:
            case 0x45:
            case 0x46:
            case 0x47:
            case 0x48:
            case 0x49:
            case 0x4a:
            case 0x4b:
            case 0x4c:
            case 0x4d:
            case 0x4e:
            case 0x4f:
            case 0x50:
            case 0x51:
            case 0x52:
            case 0x53:
            case 0x54:
            case 0x55:
            case 0x56:
            case 0x57:
            case 0x58:
            case 0x59:
            case 0x5a:
            case 0x5b:
            case 0x5c:
            case 0x5d:
            case 0x5e:
            case 0x5f:
            case 0x98:
            case 0x99:
            case 0xc9:
            case 0x9c:
            case 0x9d:
            case 0x06:
            case 0x0e:
            case 0x16:
            case 0x1e:
            case 0x07:
            case 0x17:
            case 0x1f:
            case 0xc3:
            case 0xcb:
            case 0x90:
            case 0xcc:
            case 0xce:
            case 0xcf:
            case 0xf5:
            case 0xf8:
            case 0xf9:
            case 0xfc:
            case 0xfd:
            case 0xfa:
            case 0xfb:
            case 0x9e:
            case 0x9f:
            case 0xf4:
            case 0xa4:
            case 0xa5:
            case 0xaa:
            case 0xab:
            case 0xa6:
            case 0xa7:
            case 0xac:
            case 0xad:
            case 0xae:
            case 0xaf:
            case 0x9b:
            case 0xec:
            case 0xed:
            case 0xee:
            case 0xef:
            case 0xd7:
            case 0x27:
            case 0x2f:
            case 0x37:
            case 0x3f:
            case 0x60:
            case 0x61:
            case 0x6c:
            case 0x6d:
            case 0x6e:
            case 0x6f:
                break Start;
            case 0xb0:
            case 0xb1:
            case 0xb2:
            case 0xb3:
            case 0xb4:
            case 0xb5:
            case 0xb6:
            case 0xb7:
            case 0x04:
            case 0x0c:
            case 0x14:
            case 0x1c:
            case 0x24:
            case 0x2c:
            case 0x34:
            case 0x3c:
            case 0xa8:
            case 0x6a:
            case 0xeb:
            case 0x70:
            case 0x71:
            case 0x72:
            case 0x73:
            case 0x76:
            case 0x77:
            case 0x78:
            case 0x79:
            case 0x7a:
            case 0x7b:
            case 0x7c:
            case 0x7d:
            case 0x7e:
            case 0x7f:
            case 0x74:
            case 0x75:
            case 0xe0:
            case 0xe1:
            case 0xe2:
            case 0xe3:
            case 0xcd:
            case 0xe4:
            case 0xe5:
            case 0xe6:
            case 0xe7:
            case 0xd4:
            case 0xd5:
                n++;
                if (n > 15) Interrupt(6);
                break Start;
            case 0xb8:
            case 0xb9:
            case 0xba:
            case 0xbb:
            case 0xbc:
            case 0xbd:
            case 0xbe:
            case 0xbf:
            case 0x05:
            case 0x0d:
            case 0x15:
            case 0x1d:
            case 0x25:
            case 0x2d:
            case 0x35:
            case 0x3d:
            case 0xa9:
            case 0x68:
            case 0xe9:
            case 0xe8:
                n += Ed;
                if (n > 15) Interrupt(6);
                break Start;
            case 0x88:
            case 0x89:
            case 0x8a:
            case 0x8b:
            case 0x86:
            case 0x87:
            case 0x8e:
            case 0x8c:
            case 0xc4:
            case 0xc5:
            case 0x00:
            case 0x08:
            case 0x10:
            case 0x18:
            case 0x20:
            case 0x28:
            case 0x30:
            case 0x38:
            case 0x01:
            case 0x09:
            case 0x11:
            case 0x19:
            case 0x21:
            case 0x29:
            case 0x31:
            case 0x39:
            case 0x02:
            case 0x0a:
            case 0x12:
            case 0x1a:
            case 0x22:
            case 0x2a:
            case 0x32:
            case 0x3a:
            case 0x03:
            case 0x0b:
            case 0x13:
            case 0x1b:
            case 0x23:
            case 0x2b:
            case 0x33:
            case 0x3b:
            case 0x84:
            case 0x85:
            case 0xd0:
            case 0xd1:
            case 0xd2:
            case 0xd3:
            case 0x8f:
            case 0x8d:
            case 0xfe:
            case 0xff:
            case 0xd8:
            case 0xd9:
            case 0xda:
            case 0xdb:
            case 0xdc:
            case 0xdd:
            case 0xde:
            case 0xdf:
            case 0x62:
            case 0x63:
                {
                    {
                        if ((n + 1) > 15) Interrupt(6);
                        v_addr = (Nb + (n++)) >> 0;
                        ModRM = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    };
                    if (Da & 0x0080) {
                        switch (ModRM >> 6) {
                        case 0:
                            if ((ModRM & 7) == 6) n += 2;
                            break;
                        case 1:
                            n++;
                            break;
                        default:
                            n += 2;
                            break;
                        }
                    } else {
                        switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
                        case 0x04:
                            {
                                if ((n + 1) > 15) Interrupt(6);
                                v_addr = (Nb + (n++)) >> 0;
                                Dd = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                            };
                            if ((Dd & 7) == 5) {
                                n += 4;
                            }
                            break;
                        case 0x0c:
                            n += 2;
                            break;
                        case 0x14:
                            n += 5;
                            break;
                        case 0x05:
                            n += 4;
                            break;
                        case 0x00:
                        case 0x01:
                        case 0x02:
                        case 0x03:
                        case 0x06:
                        case 0x07:
                            break;
                        case 0x08:
                        case 0x09:
                        case 0x0a:
                        case 0x0b:
                        case 0x0d:
                        case 0x0e:
                        case 0x0f:
                            n++;
                            break;
                        case 0x10:
                        case 0x11:
                        case 0x12:
                        case 0x13:
                        case 0x15:
                        case 0x16:
                        case 0x17:
                            n += 4;
                            break;
                        }
                    }
                    if (n > 15) Interrupt(6);
                };
                break Start;
            case 0xa0:
            case 0xa1:
            case 0xa2:
            case 0xa3:
                if (Da & 0x0100) n += 2;
                else n += 4;
                if (n > 15) Interrupt(6);
                break Start;
            case 0xc6:
            case 0x80:
            case 0x82:
            case 0x83:
            case 0x6b:
            case 0xc0:
            case 0xc1:
                {
                    {
                        if ((n + 1) > 15) Interrupt(6);
                        v_addr = (Nb + (n++)) >> 0;
                        ModRM = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    };
                    if (Da & 0x0080) {
                        switch (ModRM >> 6) {
                        case 0:
                            if ((ModRM & 7) == 6) n += 2;
                            break;
                        case 1:
                            n++;
                            break;
                        default:
                            n += 2;
                            break;
                        }
                    } else {
                        switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
                        case 0x04:
                            {
                                if ((n + 1) > 15) Interrupt(6);
                                v_addr = (Nb + (n++)) >> 0;
                                Dd = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                            };
                            if ((Dd & 7) == 5) {
                                n += 4;
                            }
                            break;
                        case 0x0c:
                            n += 2;
                            break;
                        case 0x14:
                            n += 5;
                            break;
                        case 0x05:
                            n += 4;
                            break;
                        case 0x00:
                        case 0x01:
                        case 0x02:
                        case 0x03:
                        case 0x06:
                        case 0x07:
                            break;
                        case 0x08:
                        case 0x09:
                        case 0x0a:
                        case 0x0b:
                        case 0x0d:
                        case 0x0e:
                        case 0x0f:
                            n++;
                            break;
                        case 0x10:
                        case 0x11:
                        case 0x12:
                        case 0x13:
                        case 0x15:
                        case 0x16:
                        case 0x17:
                            n += 4;
                            break;
                        }
                    }
                    if (n > 15) Interrupt(6);
                };
                n++;
                if (n > 15) Interrupt(6);
                break Start;
            case 0xc7:
            case 0x81:
            case 0x69:
                {
                    {
                        if ((n + 1) > 15) Interrupt(6);
                        v_addr = (Nb + (n++)) >> 0;
                        ModRM = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    };
                    if (Da & 0x0080) {
                        switch (ModRM >> 6) {
                        case 0:
                            if ((ModRM & 7) == 6) n += 2;
                            break;
                        case 1:
                            n++;
                            break;
                        default:
                            n += 2;
                            break;
                        }
                    } else {
                        switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
                        case 0x04:
                            {
                                if ((n + 1) > 15) Interrupt(6);
                                v_addr = (Nb + (n++)) >> 0;
                                Dd = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                            };
                            if ((Dd & 7) == 5) {
                                n += 4;
                            }
                            break;
                        case 0x0c:
                            n += 2;
                            break;
                        case 0x14:
                            n += 5;
                            break;
                        case 0x05:
                            n += 4;
                            break;
                        case 0x00:
                        case 0x01:
                        case 0x02:
                        case 0x03:
                        case 0x06:
                        case 0x07:
                            break;
                        case 0x08:
                        case 0x09:
                        case 0x0a:
                        case 0x0b:
                        case 0x0d:
                        case 0x0e:
                        case 0x0f:
                            n++;
                            break;
                        case 0x10:
                        case 0x11:
                        case 0x12:
                        case 0x13:
                        case 0x15:
                        case 0x16:
                        case 0x17:
                            n += 4;
                            break;
                        }
                    }
                    if (n > 15) Interrupt(6);
                };
                n += Ed;
                if (n > 15) Interrupt(6);
                break Start;
            case 0xf6:
                {
                    {
                        if ((n + 1) > 15) Interrupt(6);
                        v_addr = (Nb + (n++)) >> 0;
                        ModRM = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    };
                    if (Da & 0x0080) {
                        switch (ModRM >> 6) {
                        case 0:
                            if ((ModRM & 7) == 6) n += 2;
                            break;
                        case 1:
                            n++;
                            break;
                        default:
                            n += 2;
                            break;
                        }
                    } else {
                        switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
                        case 0x04:
                            {
                                if ((n + 1) > 15) Interrupt(6);
                                v_addr = (Nb + (n++)) >> 0;
                                Dd = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                            };
                            if ((Dd & 7) == 5) {
                                n += 4;
                            }
                            break;
                        case 0x0c:
                            n += 2;
                            break;
                        case 0x14:
                            n += 5;
                            break;
                        case 0x05:
                            n += 4;
                            break;
                        case 0x00:
                        case 0x01:
                        case 0x02:
                        case 0x03:
                        case 0x06:
                        case 0x07:
                            break;
                        case 0x08:
                        case 0x09:
                        case 0x0a:
                        case 0x0b:
                        case 0x0d:
                        case 0x0e:
                        case 0x0f:
                            n++;
                            break;
                        case 0x10:
                        case 0x11:
                        case 0x12:
                        case 0x13:
                        case 0x15:
                        case 0x16:
                        case 0x17:
                            n += 4;
                            break;
                        }
                    }
                    if (n > 15) Interrupt(6);
                };
                CommandIndex = (ModRM >> 3) & 7;
                if (CommandIndex == 0) {
                    n++;
                    if (n > 15) Interrupt(6);
                }
                break Start;
            case 0xf7:
                {
                    {
                        if ((n + 1) > 15) Interrupt(6);
                        v_addr = (Nb + (n++)) >> 0;
                        ModRM = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    };
                    if (Da & 0x0080) {
                        switch (ModRM >> 6) {
                        case 0:
                            if ((ModRM & 7) == 6) n += 2;
                            break;
                        case 1:
                            n++;
                            break;
                        default:
                            n += 2;
                            break;
                        }
                    } else {
                        switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
                        case 0x04:
                            {
                                if ((n + 1) > 15) Interrupt(6);
                                v_addr = (Nb + (n++)) >> 0;
                                Dd = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                            };
                            if ((Dd & 7) == 5) {
                                n += 4;
                            }
                            break;
                        case 0x0c:
                            n += 2;
                            break;
                        case 0x14:
                            n += 5;
                            break;
                        case 0x05:
                            n += 4;
                            break;
                        case 0x00:
                        case 0x01:
                        case 0x02:
                        case 0x03:
                        case 0x06:
                        case 0x07:
                            break;
                        case 0x08:
                        case 0x09:
                        case 0x0a:
                        case 0x0b:
                        case 0x0d:
                        case 0x0e:
                        case 0x0f:
                            n++;
                            break;
                        case 0x10:
                        case 0x11:
                        case 0x12:
                        case 0x13:
                        case 0x15:
                        case 0x16:
                        case 0x17:
                            n += 4;
                            break;
                        }
                    }
                    if (n > 15) Interrupt(6);
                };
                CommandIndex = (ModRM >> 3) & 7;
                if (CommandIndex == 0) {
                    n += Ed;
                    if (n > 15) Interrupt(6);
                }
                break Start;
            case 0xea:
            case 0x9a:
                n += 2 + Ed;
                if (n > 15) Interrupt(6);
                break Start;
            case 0xc2:
            case 0xca:
                n += 2;
                if (n > 15) Interrupt(6);
                break Start;
            case 0xc8:
                n += 3;
                if (n > 15) Interrupt(6);
                break Start;
            case 0xd6:
            case 0xf1:
            default:
                Interrupt(6);
            case 0x0f:
                {
                    if ((n + 1) > 15) Interrupt(6);
                    v_addr = (Nb + (n++)) >> 0;
                    param = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                };
                switch (param) {
                case 0x06:
                case 0xa2:
                case 0x31:
                case 0xa0:
                case 0xa8:
                case 0xa1:
                case 0xa9:
                case 0xc8:
                case 0xc9:
                case 0xca:
                case 0xcb:
                case 0xcc:
                case 0xcd:
                case 0xce:
                case 0xcf:
                    break Start;
                case 0x80:
                case 0x81:
                case 0x82:
                case 0x83:
                case 0x84:
                case 0x85:
                case 0x86:
                case 0x87:
                case 0x88:
                case 0x89:
                case 0x8a:
                case 0x8b:
                case 0x8c:
                case 0x8d:
                case 0x8e:
                case 0x8f:
                    n += Ed;
                    if (n > 15) Interrupt(6);
                    break Start;
                case 0x90:
                case 0x91:
                case 0x92:
                case 0x93:
                case 0x94:
                case 0x95:
                case 0x96:
                case 0x97:
                case 0x98:
                case 0x99:
                case 0x9a:
                case 0x9b:
                case 0x9c:
                case 0x9d:
                case 0x9e:
                case 0x9f:
                case 0x40:
                case 0x41:
                case 0x42:
                case 0x43:
                case 0x44:
                case 0x45:
                case 0x46:
                case 0x47:
                case 0x48:
                case 0x49:
                case 0x4a:
                case 0x4b:
                case 0x4c:
                case 0x4d:
                case 0x4e:
                case 0x4f:
                case 0xb6:
                case 0xb7:
                case 0xbe:
                case 0xbf:
                case 0x00:
                case 0x01:
                case 0x02:
                case 0x03:
                case 0x20:
                case 0x22:
                case 0x23:
                case 0xb2:
                case 0xb4:
                case 0xb5:
                case 0xa5:
                case 0xad:
                case 0xa3:
                case 0xab:
                case 0xb3:
                case 0xbb:
                case 0xbc:
                case 0xbd:
                case 0xaf:
                case 0xc0:
                case 0xc1:
                case 0xb0:
                case 0xb1:
                    {
                        {
                            if ((n + 1) > 15) Interrupt(6);
                            v_addr = (Nb + (n++)) >> 0;
                            ModRM = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                        };
                        if (Da & 0x0080) {
                            switch (ModRM >> 6) {
                            case 0:
                                if ((ModRM & 7) == 6) n += 2;
                                break;
                            case 1:
                                n++;
                                break;
                            default:
                                n += 2;
                                break;
                            }
                        } else {
                            switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
                            case 0x04:
                                {
                                    if ((n + 1) > 15) Interrupt(6);
                                    v_addr = (Nb + (n++)) >> 0;
                                    Dd = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                                };
                                if ((Dd & 7) == 5) {
                                    n += 4;
                                }
                                break;
                            case 0x0c:
                                n += 2;
                                break;
                            case 0x14:
                                n += 5;
                                break;
                            case 0x05:
                                n += 4;
                                break;
                            case 0x00:
                            case 0x01:
                            case 0x02:
                            case 0x03:
                            case 0x06:
                            case 0x07:
                                break;
                            case 0x08:
                            case 0x09:
                            case 0x0a:
                            case 0x0b:
                            case 0x0d:
                            case 0x0e:
                            case 0x0f:
                                n++;
                                break;
                            case 0x10:
                            case 0x11:
                            case 0x12:
                            case 0x13:
                            case 0x15:
                            case 0x16:
                            case 0x17:
                                n += 4;
                                break;
                            }
                        }
                        if (n > 15) Interrupt(6);
                    };
                    break Start;
                case 0xa4:
                case 0xac:
                case 0xba:
                    {
                        {
                            if ((n + 1) > 15) Interrupt(6);
                            v_addr = (Nb + (n++)) >> 0;
                            ModRM = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                        };
                        if (Da & 0x0080) {
                            switch (ModRM >> 6) {
                            case 0:
                                if ((ModRM & 7) == 6) n += 2;
                                break;
                            case 1:
                                n++;
                                break;
                            default:
                                n += 2;
                                break;
                            }
                        } else {
                            switch ((ModRM & 7) | ((ModRM >> 3) & 0x18)) {
                            case 0x04:
                                {
                                    if ((n + 1) > 15) Interrupt(6);
                                    v_addr = (Nb + (n++)) >> 0;
                                    Dd = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                                };
                                if ((Dd & 7) == 5) {
                                    n += 4;
                                }
                                break;
                            case 0x0c:
                                n += 2;
                                break;
                            case 0x14:
                                n += 5;
                                break;
                            case 0x05:
                                n += 4;
                                break;
                            case 0x00:
                            case 0x01:
                            case 0x02:
                            case 0x03:
                            case 0x06:
                            case 0x07:
                                break;
                            case 0x08:
                            case 0x09:
                            case 0x0a:
                            case 0x0b:
                            case 0x0d:
                            case 0x0e:
                            case 0x0f:
                                n++;
                                break;
                            case 0x10:
                            case 0x11:
                            case 0x12:
                            case 0x13:
                            case 0x15:
                            case 0x16:
                            case 0x17:
                                n += 4;
                                break;
                            }
                        }
                        if (n > 15) Interrupt(6);
                    };
                    n++;
                    if (n > 15) Interrupt(6);
                    break Start;
                case 0x04:
                case 0x05:
                case 0x07:
                case 0x08:
                case 0x09:
                case 0x0a:
                case 0x0b:
                case 0x0c:
                case 0x0d:
                case 0x0e:
                case 0x0f:
                case 0x10:
                case 0x11:
                case 0x12:
                case 0x13:
                case 0x14:
                case 0x15:
                case 0x16:
                case 0x17:
                case 0x18:
                case 0x19:
                case 0x1a:
                case 0x1b:
                case 0x1c:
                case 0x1d:
                case 0x1e:
                case 0x1f:
                case 0x21:
                case 0x24:
                case 0x25:
                case 0x26:
                case 0x27:
                case 0x28:
                case 0x29:
                case 0x2a:
                case 0x2b:
                case 0x2c:
                case 0x2d:
                case 0x2e:
                case 0x2f:
                case 0x30:
                case 0x32:
                case 0x33:
                case 0x34:
                case 0x35:
                case 0x36:
                case 0x37:
                case 0x38:
                case 0x39:
                case 0x3a:
                case 0x3b:
                case 0x3c:
                case 0x3d:
                case 0x3e:
                case 0x3f:
                case 0x50:
                case 0x51:
                case 0x52:
                case 0x53:
                case 0x54:
                case 0x55:
                case 0x56:
                case 0x57:
                case 0x58:
                case 0x59:
                case 0x5a:
                case 0x5b:
                case 0x5c:
                case 0x5d:
                case 0x5e:
                case 0x5f:
                case 0x60:
                case 0x61:
                case 0x62:
                case 0x63:
                case 0x64:
                case 0x65:
                case 0x66:
                case 0x67:
                case 0x68:
                case 0x69:
                case 0x6a:
                case 0x6b:
                case 0x6c:
                case 0x6d:
                case 0x6e:
                case 0x6f:
                case 0x70:
                case 0x71:
                case 0x72:
                case 0x73:
                case 0x74:
                case 0x75:
                case 0x76:
                case 0x77:
                case 0x78:
                case 0x79:
                case 0x7a:
                case 0x7b:
                case 0x7c:
                case 0x7d:
                case 0x7e:
                case 0x7f:
                case 0xa6:
                case 0xa7:
                case 0xaa:
                case 0xae:
                case 0xb8:
                case 0xb9:
                case 0xc2:
                case 0xc3:
                case 0xc4:
                case 0xc5:
                case 0xc6:
                case 0xc7:
                default:
                    Interrupt(6);
                }
                break;
            }
        }
        return n;
    }
    function LoadMissingVaddrIntoPageTable(v_addr, is_write, is_user_mode) {
        var pdb_entry_addr, pde, error_code, pde_addr, pte, page_flags, is_dirty, ud, Od;
		//http://en.wikipedia.org/wiki/Control_register#CR0
		//check if paging is enabled.
        if (! (alias_CPU_X86.cr0 & (1 << 31))) {
			//disabled, so va = pa.
            alias_CPU_X86.tlb_set_page(v_addr & -4096, v_addr & -4096, 1);
        } else {
			//cr3 is pdbr, only high 20 bits is valid and 
			//point to physical tbl.
			//http://baike.baidu.com/view/4092816.htm
            pdb_entry_addr = (alias_CPU_X86.cr3 & -4096) + ((v_addr >> 20) & 0xffc);
            pde = alias_CPU_X86.ld32_phys(pdb_entry_addr);
			
			//the lowest bit is 0, means the entry is invalid.
			//64-ia-32-architectures-software-developer-vol-3a-part-1-manual.pdf
			//p102 fig4-4
            if (! (pde & 0x00000001)) {
                error_code = 0;
            } else {
				//p103 tbl4-4
				//set the accessed bit
                if (! (pde & 0x00000020)) {
                    pde |= 0x00000020;
                    alias_CPU_X86.st32_phys(pdb_entry_addr, pde);
                }
                pde_addr = (pde & -4096) + ((v_addr >> 10) & 0xffc);
                pte = alias_CPU_X86.ld32_phys(pde_addr);

				//the lowest bit is 0, means the entry is invalid.
				//64-ia-32-architectures-software-developer-vol-3a-part-1-manual.pdf
				//p102 fig4-4
                if (! (pte & 0x00000001)) {
                    error_code = 0;
                } else {
                    page_flags = pte & pde;
                    if (is_user_mode && !(page_flags & 0x00000004)) {
						//check User/supervisor consistency.
						//p103 tbl4-4
                        error_code = 0x01;
                    } else if (is_write && !(page_flags & 0x00000002)) {
						//check read/write consistency.
						//p103 tbl4-4
                        error_code = 0x01;
                    } else {
						//check dirty bit.
						//p103 tbl4-4
                        is_dirty = (is_write && !(pte & 0x00000040));
                        if (! (pte & 0x00000020) || is_dirty) {
                            pte |= 0x00000020;
                            if (is_dirty) 
								pte |= 0x00000040;
                            alias_CPU_X86.st32_phys(pde_addr, pte);
                        }
                        ud = 0;
                        if ((pte & 0x00000040) && (page_flags & 0x00000002)) ud = 1;
                        Od = 0;
                        if (page_flags & 0x00000004) Od = 1;
                        alias_CPU_X86.tlb_set_page(v_addr & -4096, pte & -4096, ud, Od);
                        return;
                    }
                }
            }
            error_code |= is_write << 1;
            if (is_user_mode)
				error_code |= 0x04;
            alias_CPU_X86.cr2 = v_addr;
			//p174
            interuption(14, error_code);
        }
    }
    function Pd(Qd) {
        if (! (Qd & (1 << 0))) nd("real mode not supported");
        if ((Qd & ((1 << 31) | (1 << 16) | (1 << 0))) != (alias_CPU_X86.cr0 & ((1 << 31) | (1 << 16) | (1 << 0)))) {
            alias_CPU_X86.tlb_flush_all();
        }
        alias_CPU_X86.cr0 = Qd | (1 << 4);
    }
    function Rd(Sd) {
        alias_CPU_X86.cr3 = Sd;
        if (alias_CPU_X86.cr0 & (1 << 31)) {
            alias_CPU_X86.tlb_flush_all();
        }
    }
    function Td(Ud) {
        alias_CPU_X86.cr4 = Ud;
    }
    function Vd(Wd) {
        if (Wd & (1 << 22)) return - 1;
        else return 0xffff;
    }
    function Xd(selector) {
        var sa, Rb, Yd, Wd;
        if (selector & 0x4) sa = alias_CPU_X86.ldt;
        else sa = alias_CPU_X86.gdt;
        Rb = selector & ~7;
        if ((Rb + 7) > sa.limit) return null;
        v_addr = sa.base + Rb;
        Yd = ReadIntFromVaddrReadOnlySys();
        v_addr += 4;
        Wd = ReadIntFromVaddrReadOnlySys();
        return [Yd, Wd];
    }
    function Zd(Yd, Wd) {
        var limit;
        limit = (Yd & 0xffff) | (Wd & 0x000f0000);
        if (Wd & (1 << 23)) limit = (limit << 12) | 0xfff;
        return limit;
    }
    function ae(Yd, Wd) {
        return (((Yd >>> 16) | ((Wd & 0xff) << 16) | (Wd & 0xff000000))) & -1;
    }
    function be(sa, Yd, Wd) {
        sa.base = ae(Yd, Wd);
        sa.limit = Zd(Yd, Wd);
        sa.flags = Wd;
    }
    function ce() {
        Na = alias_CPU_X86.SegDescriptors[1].base;
        Oa = alias_CPU_X86.SegDescriptors[2].base;
        if (alias_CPU_X86.SegDescriptors[2].flags & (1 << 22)) Pa = -1;
        else Pa = 0xffff;
        Qa = (((Na | Oa | alias_CPU_X86.SegDescriptors[3].base | alias_CPU_X86.SegDescriptors[0].base) == 0) && Pa == -1);
        if (alias_CPU_X86.SegDescriptors[1].flags & (1 << 22)) Ra = 0;
        else Ra = 0x0100 | 0x0080;
    }
    function UpdateRegister8086(SegRegIndex, selector, base, limit, flags) {
        alias_CPU_X86.SegDescriptors[SegRegIndex] = {
            selector: selector,
            base: base,
            limit: limit,
            flags: flags
        };
        ce();
    }
    function LoadSelectorIntoSegRegister8086(SegRegIndex, selector) {
        UpdateRegister8086(SegRegIndex, selector, (selector << 4), 0xffff, (1 << 15) | (3 << 13) | (1 << 12) | (1 << 8) | (1 << 12) | (1 << 9));
    }
    function ge(he) {
        var ie, Rb, je, ke, le;
        if (! (alias_CPU_X86.tr.flags & (1 << 15))) nd("invalid tss");
        ie = (alias_CPU_X86.tr.flags >> 8) & 0xf;
        if ((ie & 7) != 1) nd("invalid tss type");
        je = ie >> 3;
        Rb = (he * 4 + 2) << je;
        if (Rb + (4 << je) - 1 > alias_CPU_X86.tr.limit) interuption(10, alias_CPU_X86.tr.selector & 0xfffc);
        v_addr = (alias_CPU_X86.tr.base + Rb) & -1;
        if (je == 0) {
            le = ReadShortFromVaddrReadOnlySys();
            v_addr += 2;
        } else {
            le = ReadIntFromVaddrReadOnlySys();
            v_addr += 4;
        }
        ke = ReadShortFromVaddrReadOnlySys();
        return [ke, le];
    }
    function me(intno, ne, error_code, oe, pe) {
        var sa, qe, ie, he, selector, re, se;
        var te, ue, je;
        var e, Yd, Wd, ve, ke, le, we, xe;
        var ye, Pa;
        te = 0;
        if (!ne && !pe) {
            switch (intno) {
            case 8:
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 17:
                te = 1;
                break;
            }
        }
        if (ne) ye = oe;
        else ye = EIPDword;
        sa = alias_CPU_X86.idt;
        if (intno * 8 + 7 > sa.limit) interuption(13, intno * 8 + 2);
        v_addr = (sa.base + intno * 8) & -1;
        Yd = ReadIntFromVaddrReadOnlySys();
        v_addr += 4;
        Wd = ReadIntFromVaddrReadOnlySys();
        ie = (Wd >> 8) & 0x1f;
        switch (ie) {
        case 5:
        case 7:
        case 6:
            throw "unsupported task gate";
        case 14:
        case 15:
            break;
        default:
            interuption(13, intno * 8 + 2);
            break;
        }
        he = (Wd >> 13) & 3;
        se = alias_CPU_X86.cpl;
        if (ne && he < se) interuption(13, intno * 8 + 2);
        if (! (Wd & (1 << 15))) interuption(11, intno * 8 + 2);
        selector = Yd >> 16;
        ve = (Wd & -65536) | (Yd & 0x0000ffff);
        if ((selector & 0xfffc) == 0) interuption(13, 0);
        e = Xd(selector);
        if (!e) interuption(13, selector & 0xfffc);
        Yd = e[0];
        Wd = e[1];
        if (! (Wd & (1 << 12)) || !(Wd & ((1 << 11)))) interuption(13, selector & 0xfffc);
        he = (Wd >> 13) & 3;
        if (he > se) interuption(13, selector & 0xfffc);
        if (! (Wd & (1 << 15))) interuption(11, selector & 0xfffc);
        if (! (Wd & (1 << 10)) && he < se) {
            e = ge(he);
            ke = e[0];
            le = e[1];
            if ((ke & 0xfffc) == 0) interuption(10, ke & 0xfffc);
            if ((ke & 3) != he) interuption(10, ke & 0xfffc);
            e = Xd(ke);
            if (!e) interuption(10, ke & 0xfffc);
            we = e[0];
            xe = e[1];
            re = (xe >> 13) & 3;
            if (re != he) interuption(10, ke & 0xfffc);
            if (! (xe & (1 << 12)) || (xe & (1 << 11)) || !(xe & (1 << 9))) interuption(10, ke & 0xfffc);
            if (! (xe & (1 << 15))) interuption(10, ke & 0xfffc);
            ue = 1;
            Pa = Vd(xe);
            qe = ae(we, xe);
        } else if ((Wd & (1 << 10)) || he == se) {
            if (alias_CPU_X86.eflags & 0x00020000) interuption(13, selector & 0xfffc);
            ue = 0;
            Pa = Vd(alias_CPU_X86.SegDescriptors[2].flags);
            qe = alias_CPU_X86.SegDescriptors[2].base;
            le = Registers[ESPIndex];
            he = se;
        } else {
            interuption(13, selector & 0xfffc);
            ue = 0;
            Pa = 0;
            qe = 0;
            le = 0;
        }
        je = ie >> 3;
        if (je == 1) {
            if (ue) {
                if (alias_CPU_X86.eflags & 0x00020000) {
                    {
                        le = (le - 4) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[5].selector);
                    }; {
                        le = (le - 4) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[4].selector);
                    }; {
                        le = (le - 4) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[3].selector);
                    }; {
                        le = (le - 4) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[0].selector);
                    };
                } {
                    le = (le - 4) & -1;
                    v_addr = (qe + (le & Pa)) & -1;
                    WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[2].selector);
                }; {
                    le = (le - 4) & -1;
                    v_addr = (qe + (le & Pa)) & -1;
                    WriteIntToVaddrReadWriteSys(Registers[ESPIndex]);
                };
            } {
                le = (le - 4) & -1;
                v_addr = (qe + (le & Pa)) & -1;
                WriteIntToVaddrReadWriteSys(id());
            }; {
                le = (le - 4) & -1;
                v_addr = (qe + (le & Pa)) & -1;
                WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[1].selector);
            }; {
                le = (le - 4) & -1;
                v_addr = (qe + (le & Pa)) & -1;
                WriteIntToVaddrReadWriteSys(ye);
            };
            if (te) {
                {
                    le = (le - 4) & -1;
                    v_addr = (qe + (le & Pa)) & -1;
                    WriteIntToVaddrReadWriteSys(error_code);
                };
            }
        } else {
            if (ue) {
                if (alias_CPU_X86.eflags & 0x00020000) {
                    {
                        le = (le - 2) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[5].selector);
                    }; {
                        le = (le - 2) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[4].selector);
                    }; {
                        le = (le - 2) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[3].selector);
                    }; {
                        le = (le - 2) & -1;
                        v_addr = (qe + (le & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[0].selector);
                    };
                } {
                    le = (le - 2) & -1;
                    v_addr = (qe + (le & Pa)) & -1;
                    WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[2].selector);
                }; {
                    le = (le - 2) & -1;
                    v_addr = (qe + (le & Pa)) & -1;
                    WriteShortFromVaddrReadWriteSys(Registers[ESPIndex]);
                };
            } {
                le = (le - 2) & -1;
                v_addr = (qe + (le & Pa)) & -1;
                WriteShortFromVaddrReadWriteSys(id());
            }; {
                le = (le - 2) & -1;
                v_addr = (qe + (le & Pa)) & -1;
                WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[1].selector);
            }; {
                le = (le - 2) & -1;
                v_addr = (qe + (le & Pa)) & -1;
                WriteShortFromVaddrReadWriteSys(ye);
            };
            if (te) {
                {
                    le = (le - 2) & -1;
                    v_addr = (qe + (le & Pa)) & -1;
                    WriteShortFromVaddrReadWriteSys(error_code);
                };
            }
        }
        if (ue) {
            if (alias_CPU_X86.eflags & 0x00020000) {
                UpdateRegister8086(0, 0, 0, 0, 0);
                UpdateRegister8086(3, 0, 0, 0, 0);
                UpdateRegister8086(4, 0, 0, 0, 0);
                UpdateRegister8086(5, 0, 0, 0, 0);
            }
            ke = (ke & ~3) | he;
            UpdateRegister8086(2, ke, qe, Zd(we, xe), xe);
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((le) & Pa);
        selector = (selector & ~3) | he;
        UpdateRegister8086(1, selector, ae(Yd, Wd), Zd(Yd, Wd), Wd);
        rd(he);
        EIPDword = ve,
        EIPDbyte = Mb = 0;
        if ((ie & 1) == 0) {
            alias_CPU_X86.eflags &= ~0x00000200;
        }
        alias_CPU_X86.eflags &= ~ (0x00000100 | 0x00020000 | 0x00010000 | 0x00004000);
    }
    function ze(intno, ne, error_code, oe, pe) {
        var sa, qe, selector, ve, le, ye;
        sa = alias_CPU_X86.idt;
        if (intno * 4 + 3 > sa.limit) interuption(13, intno * 8 + 2);
        v_addr = (sa.base + (intno << 2)) >> 0;
        ve = ReadShortFromVaddrReadOnlySys();
        v_addr = (v_addr + 2) >> 0;
        selector = ReadShortFromVaddrReadOnlySys();
        le = Registers[ESPIndex];
        if (ne) ye = oe;
        else ye = EIPDword; {
            le = (le - 2) >> 0;
            v_addr = ((le & Pa) + Oa) >> 0;
            WriteShortToVaddr(id());
        }; {
            le = (le - 2) >> 0;
            v_addr = ((le & Pa) + Oa) >> 0;
            WriteShortToVaddr(alias_CPU_X86.SegDescriptors[1].selector);
        }; {
            le = (le - 2) >> 0;
            v_addr = ((le & Pa) + Oa) >> 0;
            WriteShortToVaddr(ye);
        };
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((le) & Pa);
        EIPDword = ve,
        EIPDbyte = Mb = 0;
        alias_CPU_X86.SegDescriptors[1].selector = selector;
        alias_CPU_X86.SegDescriptors[1].base = (selector << 4);
        alias_CPU_X86.eflags &= ~ (0x00000200 | 0x00000100 | 0x00040000 | 0x00010000);
    }
    function Ae(intno, ne, error_code, oe, pe) {
        if (intno == 0x06) {
            var Be = EIPDword;
            var Nb;
            na = "do_interrupt: intno=" + number8_to_string(intno) + " error_code=" + number32_to_string(error_code) + " EIP=" + number32_to_string(Be) + " ESP=" + number32_to_string(Registers[ESPIndex]) + " EAX=" + number32_to_string(Registers[EAXIndex]) + " EBX=" + number32_to_string(Registers[EBXIndex]) + " ECX=" + number32_to_string(Registers[ECXIndex]);
            if (intno == 0x0e) {
                na += " CR2=" + number32_to_string(alias_CPU_X86.cr2);
            }
            console.log(na);
            if (intno == 0x06) {
                var na, i, n;
                na = "Code:";
                Nb = (Be + Na) >> 0;
                n = 4096 - (Nb & 0xfff);
                if (n > 15) n = 15;
                for (i = 0; i < n; i++) {
                    v_addr = (Nb + i) & -1;
                    na += " " + number8_to_string(ReadByteFromVaddrReadOnly());
                }
                console.log(na);
            }
        }
        if (alias_CPU_X86.cr0 & (1 << 0)) {
            me(intno, ne, error_code, oe, pe);
        } else {
            ze(intno, ne, error_code, oe, pe);
        }
    }
    function Ce(selector) {
        var sa, Yd, Wd, Rb, De;
        selector &= 0xffff;
        if ((selector & 0xfffc) == 0) {
            alias_CPU_X86.ldt.base = 0;
            alias_CPU_X86.ldt.limit = 0;
        } else {
            if (selector & 0x4) interuption(13, selector & 0xfffc);
            sa = alias_CPU_X86.gdt;
            Rb = selector & ~7;
            De = 7;
            if ((Rb + De) > sa.limit) interuption(13, selector & 0xfffc);
            v_addr = (sa.base + Rb) & -1;
            Yd = ReadIntFromVaddrReadOnlySys();
            v_addr += 4;
            Wd = ReadIntFromVaddrReadOnlySys();
            if ((Wd & (1 << 12)) || ((Wd >> 8) & 0xf) != 2) interuption(13, selector & 0xfffc);
            if (! (Wd & (1 << 15))) interuption(11, selector & 0xfffc);
            be(alias_CPU_X86.ldt, Yd, Wd);
        }
        alias_CPU_X86.ldt.selector = selector;
    }
    function Ee(selector) {
        var sa, Yd, Wd, Rb, ie, De;
        selector &= 0xffff;
        if ((selector & 0xfffc) == 0) {
            alias_CPU_X86.tr.base = 0;
            alias_CPU_X86.tr.limit = 0;
            alias_CPU_X86.tr.flags = 0;
        } else {
            if (selector & 0x4) interuption(13, selector & 0xfffc);
            sa = alias_CPU_X86.gdt;
            Rb = selector & ~7;
            De = 7;
            if ((Rb + De) > sa.limit) interuption(13, selector & 0xfffc);
            v_addr = (sa.base + Rb) & -1;
            Yd = ReadIntFromVaddrReadOnlySys();
            v_addr += 4;
            Wd = ReadIntFromVaddrReadOnlySys();
            ie = (Wd >> 8) & 0xf;
            if ((Wd & (1 << 12)) || (ie != 1 && ie != 9)) interuption(13, selector & 0xfffc);
            if (! (Wd & (1 << 15))) interuption(11, selector & 0xfffc);
            be(alias_CPU_X86.tr, Yd, Wd);
            Wd |= (1 << 9);
            WriteIntToVaddrReadWriteSys(Wd);
        }
        alias_CPU_X86.tr.selector = selector;
    }
    function LoadSelectorIntoSegRegister80386(SegRegisterIndex, selector) {
        var Yd, Wd, se, he, He, sa, Rb;
        se = alias_CPU_X86.cpl;
        if ((selector & 0xfffc) == 0) {
            if (SegRegisterIndex == 2) interuption(13, 0);
            UpdateRegister8086(SegRegisterIndex, selector, 0, 0, 0);
        } else {
            if (selector & 0x4) sa = alias_CPU_X86.ldt;
            else sa = alias_CPU_X86.gdt;
            Rb = selector & ~7;
            if ((Rb + 7) > sa.limit) interuption(13, selector & 0xfffc);
            v_addr = (sa.base + Rb) & -1;
            Yd = ReadIntFromVaddrReadOnlySys();
            v_addr += 4;
            Wd = ReadIntFromVaddrReadOnlySys();
            if (! (Wd & (1 << 12))) interuption(13, selector & 0xfffc);
            He = selector & 3;
            he = (Wd >> 13) & 3;
            if (SegRegisterIndex == 2) {
                if ((Wd & (1 << 11)) || !(Wd & (1 << 9))) interuption(13, selector & 0xfffc);
                if (He != se || he != se) interuption(13, selector & 0xfffc);
            } else {
                if ((Wd & ((1 << 11) | (1 << 9))) == (1 << 11)) interuption(13, selector & 0xfffc);
                if (! (Wd & (1 << 11)) || !(Wd & (1 << 10))) {
                    if (he < se || he < He) interuption(13, selector & 0xfffc);
                }
            }
            if (! (Wd & (1 << 15))) {
                if (SegRegisterIndex == 2) interuption(12, selector & 0xfffc);
                else interuption(11, selector & 0xfffc);
            }
            if (! (Wd & (1 << 8))) {
                Wd |= (1 << 8);
                WriteIntToVaddrReadWriteSys(Wd);
            }
            UpdateRegister8086(SegRegisterIndex, selector, ae(Yd, Wd), Zd(Yd, Wd), Wd);
        }
    }
    function LoadSelectorIntoSegRegister(SegRegisterIndex, selector) {
        var Refer;
        selector &= 0xffff;
        if (! (alias_CPU_X86.cr0 & (1 << 0))) {
            Refer = alias_CPU_X86.SegDescriptors[SegRegisterIndex];
            Refer.selector = selector;
            Refer.base = selector << 4;
        } else if (alias_CPU_X86.eflags & 0x00020000) { //8086 mode
            LoadSelectorIntoSegRegister8086(SegRegisterIndex, selector);
        } else {
            LoadSelectorIntoSegRegister80386(SegRegisterIndex, selector);
        }
    }
    function Je(Ke, Le) {
        EIPDword = Le,
        EIPDbyte = Mb = 0;
        alias_CPU_X86.SegDescriptors[1].selector = Ke;
        alias_CPU_X86.SegDescriptors[1].base = (Ke << 4);
        ce();
    }
    function Me(Ke, Le) {
        var Ne, ie, Yd, Wd, se, he, He, limit, e;
        if ((Ke & 0xfffc) == 0) interuption(13, 0);
        e = Xd(Ke);
        if (!e) interuption(13, Ke & 0xfffc);
        Yd = e[0];
        Wd = e[1];
        se = alias_CPU_X86.cpl;
        if (Wd & (1 << 12)) {
            if (! (Wd & (1 << 11))) interuption(13, Ke & 0xfffc);
            he = (Wd >> 13) & 3;
            if (Wd & (1 << 10)) {
                if (he > se) interuption(13, Ke & 0xfffc);
            } else {
                He = Ke & 3;
                if (He > se) interuption(13, Ke & 0xfffc);
                if (he != se) interuption(13, Ke & 0xfffc);
            }
            if (! (Wd & (1 << 15))) interuption(11, Ke & 0xfffc);
            limit = Zd(Yd, Wd);
            if ((Le >>> 0) > (limit >>> 0)) interuption(13, Ke & 0xfffc);
            UpdateRegister8086(1, (Ke & 0xfffc) | se, ae(Yd, Wd), limit, Wd);
            EIPDword = Le,
            EIPDbyte = Mb = 0;
        } else {
            nd("unsupported jump to call or task gate");
        }
    }
    function Oe(Ke, Le) {
        if (! (alias_CPU_X86.cr0 & (1 << 0)) || (alias_CPU_X86.eflags & 0x00020000)) {
            Je(Ke, Le);
        } else {
            Me(Ke, Le);
        }
    }
    function Pe(SegRegisterIndex, se) {
        var he, Wd;
        if ((SegRegisterIndex == 4 || SegRegisterIndex == 5) && (alias_CPU_X86.SegDescriptors[SegRegisterIndex].selector & 0xfffc) == 0) return;
        Wd = alias_CPU_X86.SegDescriptors[SegRegisterIndex].flags;
        he = (Wd >> 13) & 3;
        if (! (Wd & (1 << 11)) || !(Wd & (1 << 10))) {
            if (he < se) {
                UpdateRegister8086(SegRegisterIndex, 0, 0, 0, 0);
            }
        }
    }
    function Qe(je, Ke, Le, oe) {
        var le;
        le = Registers[ESPIndex];
        if (je) {
            {
                le = (le - 4) >> 0;
                v_addr = ((le & Pa) + Oa) >> 0;
                WriteIntToVaddr(alias_CPU_X86.SegDescriptors[1].selector);
            }; {
                le = (le - 4) >> 0;
                v_addr = ((le & Pa) + Oa) >> 0;
                WriteIntToVaddr(oe);
            };
        } else {
            {
                le = (le - 2) >> 0;
                v_addr = ((le & Pa) + Oa) >> 0;
                WriteShortToVaddr(alias_CPU_X86.SegDescriptors[1].selector);
            }; {
                le = (le - 2) >> 0;
                v_addr = ((le & Pa) + Oa) >> 0;
                WriteShortToVaddr(oe);
            };
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((le) & Pa);
        EIPDword = Le,
        EIPDbyte = Mb = 0;
        alias_CPU_X86.SegDescriptors[1].selector = Ke;
        alias_CPU_X86.SegDescriptors[1].base = (Ke << 4);
        ce();
    }
    function Re(je, Ke, Le, oe) {
        var ue, i, e;
        var Yd, Wd, se, he, He, selector, ve, Se;
        var ke, we, xe, Te, ie, re, Pa;
        var data, limit, Ue;
        var qe, Ve, We;
        if ((Ke & 0xfffc) == 0) interuption(13, 0);
        e = Xd(Ke);
        if (!e) interuption(13, Ke & 0xfffc);
        Yd = e[0];
        Wd = e[1];
        se = alias_CPU_X86.cpl;
        We = Registers[ESPIndex];
        if (Wd & (1 << 12)) {
            if (! (Wd & (1 << 11))) interuption(13, Ke & 0xfffc);
            he = (Wd >> 13) & 3;
            if (Wd & (1 << 10)) {
                if (he > se) interuption(13, Ke & 0xfffc);
            } else {
                He = Ke & 3;
                if (He > se) interuption(13, Ke & 0xfffc);
                if (he != se) interuption(13, Ke & 0xfffc);
            }
            if (! (Wd & (1 << 15))) interuption(11, Ke & 0xfffc); {
                Te = We;
                Pa = Vd(alias_CPU_X86.SegDescriptors[2].flags);
                qe = alias_CPU_X86.SegDescriptors[2].base;
                if (je) {
                    {
                        Te = (Te - 4) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[1].selector);
                    }; {
                        Te = (Te - 4) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(oe);
                    };
                } else {
                    {
                        Te = (Te - 2) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[1].selector);
                    }; {
                        Te = (Te - 2) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(oe);
                    };
                }
                limit = Zd(Yd, Wd);
                if (Le > limit) interuption(13, Ke & 0xfffc);
                Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Te) & Pa);
                UpdateRegister8086(1, (Ke & 0xfffc) | se, ae(Yd, Wd), limit, Wd);
                EIPDword = Le,
                EIPDbyte = Mb = 0;
            }
        } else {
            ie = (Wd >> 8) & 0x1f;
            he = (Wd >> 13) & 3;
            He = Ke & 3;
            switch (ie) {
            case 1:
            case 9:
            case 5:
                throw "unsupported task gate";
                return;
            case 4:
            case 12:
                break;
            default:
                interuption(13, Ke & 0xfffc);
                break;
            }
            je = ie >> 3;
            if (he < se || he < He) interuption(13, Ke & 0xfffc);
            if (! (Wd & (1 << 15))) interuption(11, Ke & 0xfffc);
            selector = Yd >> 16;
            ve = (Wd & 0xffff0000) | (Yd & 0x0000ffff);
            Se = Wd & 0x1f;
            if ((selector & 0xfffc) == 0) interuption(13, 0);
            e = Xd(selector);
            if (!e) interuption(13, selector & 0xfffc);
            Yd = e[0];
            Wd = e[1];
            if (! (Wd & (1 << 12)) || !(Wd & ((1 << 11)))) interuption(13, selector & 0xfffc);
            he = (Wd >> 13) & 3;
            if (he > se) interuption(13, selector & 0xfffc);
            if (! (Wd & (1 << 15))) interuption(11, selector & 0xfffc);
            if (! (Wd & (1 << 10)) && he < se) {
                e = ge(he);
                ke = e[0];
                Te = e[1];
                if ((ke & 0xfffc) == 0) interuption(10, ke & 0xfffc);
                if ((ke & 3) != he) interuption(10, ke & 0xfffc);
                e = Xd(ke);
                if (!e) interuption(10, ke & 0xfffc);
                we = e[0];
                xe = e[1];
                re = (xe >> 13) & 3;
                if (re != he) interuption(10, ke & 0xfffc);
                if (! (xe & (1 << 12)) || (xe & (1 << 11)) || !(xe & (1 << 9))) interuption(10, ke & 0xfffc);
                if (! (xe & (1 << 15))) interuption(10, ke & 0xfffc);
                Ue = Vd(alias_CPU_X86.SegDescriptors[2].flags);
                Ve = alias_CPU_X86.SegDescriptors[2].base;
                Pa = Vd(xe);
                qe = ae(we, xe);
                if (je) {
                    {
                        Te = (Te - 4) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[2].selector);
                    }; {
                        Te = (Te - 4) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteIntToVaddrReadWriteSys(We);
                    };
                    for (i = Se - 1; i >= 0; i--) {
                        data = Xe(Ve + ((We + i * 4) & Ue)); {
                            Te = (Te - 4) & -1;
                            v_addr = (qe + (Te & Pa)) & -1;
                            WriteIntToVaddrReadWriteSys(data);
                        };
                    }
                } else {
                    {
                        Te = (Te - 2) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[2].selector);
                    }; {
                        Te = (Te - 2) & -1;
                        v_addr = (qe + (Te & Pa)) & -1;
                        WriteShortFromVaddrReadWriteSys(We);
                    };
                    for (i = Se - 1; i >= 0; i--) {
                        data = Ye(Ve + ((We + i * 2) & Ue)); {
                            Te = (Te - 2) & -1;
                            v_addr = (qe + (Te & Pa)) & -1;
                            WriteShortFromVaddrReadWriteSys(data);
                        };
                    }
                }
                ue = 1;
            } else {
                Te = We;
                Pa = Vd(alias_CPU_X86.SegDescriptors[2].flags);
                qe = alias_CPU_X86.SegDescriptors[2].base;
                ue = 0;
            }
            if (je) {
                {
                    Te = (Te - 4) & -1;
                    v_addr = (qe + (Te & Pa)) & -1;
                    WriteIntToVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[1].selector);
                }; {
                    Te = (Te - 4) & -1;
                    v_addr = (qe + (Te & Pa)) & -1;
                    WriteIntToVaddrReadWriteSys(oe);
                };
            } else {
                {
                    Te = (Te - 2) & -1;
                    v_addr = (qe + (Te & Pa)) & -1;
                    WriteShortFromVaddrReadWriteSys(alias_CPU_X86.SegDescriptors[1].selector);
                }; {
                    Te = (Te - 2) & -1;
                    v_addr = (qe + (Te & Pa)) & -1;
                    WriteShortFromVaddrReadWriteSys(oe);
                };
            }
            if (ue) {
                ke = (ke & ~3) | he;
                UpdateRegister8086(2, ke, qe, Zd(we, xe), xe);
            }
            selector = (selector & ~3) | he;
            UpdateRegister8086(1, selector, ae(Yd, Wd), Zd(Yd, Wd), Wd);
            rd(he);
            Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Te) & Pa);
            EIPDword = ve,
            EIPDbyte = Mb = 0;
        }
    }
    function Ze(je, Ke, Le, oe) {
        if (! (alias_CPU_X86.cr0 & (1 << 0)) || (alias_CPU_X86.eflags & 0x00020000)) {
            Qe(je, Ke, Le, oe);
        } else {
            Re(je, Ke, Le, oe);
        }
    }
    function af(je, bf, cf) {
        var Te, Ke, Le, df, Pa, qe, ef;
        Pa = 0xffff;
        Te = Registers[ESPIndex];
        qe = alias_CPU_X86.SegDescriptors[2].base;
        if (je == 1) {
            {
                v_addr = (qe + (Te & Pa)) & -1;
                Le = ReadIntFromVaddrReadOnlySys();
                Te = (Te + 4) & -1;
            }; {
                v_addr = (qe + (Te & Pa)) & -1;
                Ke = ReadIntFromVaddrReadOnlySys();
                Te = (Te + 4) & -1;
            };
            Ke &= 0xffff;
            if (bf) {
                v_addr = (qe + (Te & Pa)) & -1;
                df = ReadIntFromVaddrReadOnlySys();
                Te = (Te + 4) & -1;
            };
        } else {
            {
                v_addr = (qe + (Te & Pa)) & -1;
                Le = ReadShortFromVaddrReadOnlySys();
                Te = (Te + 2) & -1;
            }; {
                v_addr = (qe + (Te & Pa)) & -1;
                Ke = ReadShortFromVaddrReadOnlySys();
                Te = (Te + 2) & -1;
            };
            if (bf) {
                v_addr = (qe + (Te & Pa)) & -1;
                df = ReadShortFromVaddrReadOnlySys();
                Te = (Te + 2) & -1;
            };
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Te + cf) & Pa);
        alias_CPU_X86.SegDescriptors[1].selector = Ke;
        alias_CPU_X86.SegDescriptors[1].base = (Ke << 4);
        EIPDword = Le,
        EIPDbyte = Mb = 0;
        if (bf) {
            if (alias_CPU_X86.eflags & 0x00020000) ef = 0x00000100 | 0x00040000 | 0x00200000 | 0x00000200 | 0x00010000 | 0x00004000;
            else ef = 0x00000100 | 0x00040000 | 0x00200000 | 0x00000200 | 0x00003000 | 0x00010000 | 0x00004000;
            if (je == 0) ef &= 0xffff;
            kd(df, ef);
        }
        ce();
    }
    function ff(je, bf, cf) {
        var Ke, df, gf;
        var hf, jf, kf, lf;
        var e, Yd, Wd, we, xe;
        var se, he, He, ef, Sa;
        var qe, Te, Le, wd, Pa;
        Pa = Vd(alias_CPU_X86.SegDescriptors[2].flags);
        Te = Registers[ESPIndex];
        qe = alias_CPU_X86.SegDescriptors[2].base;
        df = 0;
        if (je == 1) {
            {
                v_addr = (qe + (Te & Pa)) & -1;
                Le = ReadIntFromVaddrReadOnlySys();
                Te = (Te + 4) & -1;
            }; {
                v_addr = (qe + (Te & Pa)) & -1;
                Ke = ReadIntFromVaddrReadOnlySys();
                Te = (Te + 4) & -1;
            };
            Ke &= 0xffff;
            if (bf) {
                {
                    v_addr = (qe + (Te & Pa)) & -1;
                    df = ReadIntFromVaddrReadOnlySys();
                    Te = (Te + 4) & -1;
                };
                if (df & 0x00020000) {
                    {
                        v_addr = (qe + (Te & Pa)) & -1;
                        wd = ReadIntFromVaddrReadOnlySys();
                        Te = (Te + 4) & -1;
                    }; {
                        v_addr = (qe + (Te & Pa)) & -1;
                        gf = ReadIntFromVaddrReadOnlySys();
                        Te = (Te + 4) & -1;
                    }; {
                        v_addr = (qe + (Te & Pa)) & -1;
                        hf = ReadIntFromVaddrReadOnlySys();
                        Te = (Te + 4) & -1;
                    }; {
                        v_addr = (qe + (Te & Pa)) & -1;
                        jf = ReadIntFromVaddrReadOnlySys();
                        Te = (Te + 4) & -1;
                    }; {
                        v_addr = (qe + (Te & Pa)) & -1;
                        kf = ReadIntFromVaddrReadOnlySys();
                        Te = (Te + 4) & -1;
                    }; {
                        v_addr = (qe + (Te & Pa)) & -1;
                        lf = ReadIntFromVaddrReadOnlySys();
                        Te = (Te + 4) & -1;
                    };
                    kd(df, 0x00000100 | 0x00040000 | 0x00200000 | 0x00000200 | 0x00003000 | 0x00020000 | 0x00004000 | 0x00080000 | 0x00100000);
                    LoadSelectorIntoSegRegister8086(1, Ke & 0xffff);
                    rd(3);
                    LoadSelectorIntoSegRegister8086(2, gf & 0xffff);
                    LoadSelectorIntoSegRegister8086(0, hf & 0xffff);
                    LoadSelectorIntoSegRegister8086(3, jf & 0xffff);
                    LoadSelectorIntoSegRegister8086(4, kf & 0xffff);
                    LoadSelectorIntoSegRegister8086(5, lf & 0xffff);
                    EIPDword = Le & 0xffff,
                    EIPDbyte = Mb = 0;
                    Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((wd) & Pa);
                    return;
                }
            }
        } else {
            {
                v_addr = (qe + (Te & Pa)) & -1;
                Le = ReadShortFromVaddrReadOnlySys();
                Te = (Te + 2) & -1;
            }; {
                v_addr = (qe + (Te & Pa)) & -1;
                Ke = ReadShortFromVaddrReadOnlySys();
                Te = (Te + 2) & -1;
            };
            if (bf) {
                v_addr = (qe + (Te & Pa)) & -1;
                df = ReadShortFromVaddrReadOnlySys();
                Te = (Te + 2) & -1;
            };
        }
        if ((Ke & 0xfffc) == 0) interuption(13, Ke & 0xfffc);
        e = Xd(Ke);
        if (!e) interuption(13, Ke & 0xfffc);
        Yd = e[0];
        Wd = e[1];
        if (! (Wd & (1 << 12)) || !(Wd & (1 << 11))) interuption(13, Ke & 0xfffc);
        se = alias_CPU_X86.cpl;
        He = Ke & 3;
        if (He < se) interuption(13, Ke & 0xfffc);
        he = (Wd >> 13) & 3;
        if (Wd & (1 << 10)) {
            if (he > He) interuption(13, Ke & 0xfffc);
        } else {
            if (he != He) interuption(13, Ke & 0xfffc);
        }
        if (! (Wd & (1 << 15))) interuption(11, Ke & 0xfffc);
        Te = (Te + cf) & -1;
        if (He == se) {
            UpdateRegister8086(1, Ke, ae(Yd, Wd), Zd(Yd, Wd), Wd);
        } else {
            if (je == 1) {
                {
                    v_addr = (qe + (Te & Pa)) & -1;
                    wd = ReadIntFromVaddrReadOnlySys();
                    Te = (Te + 4) & -1;
                }; {
                    v_addr = (qe + (Te & Pa)) & -1;
                    gf = ReadIntFromVaddrReadOnlySys();
                    Te = (Te + 4) & -1;
                };
                gf &= 0xffff;
            } else {
                {
                    v_addr = (qe + (Te & Pa)) & -1;
                    wd = ReadShortFromVaddrReadOnlySys();
                    Te = (Te + 2) & -1;
                }; {
                    v_addr = (qe + (Te & Pa)) & -1;
                    gf = ReadShortFromVaddrReadOnlySys();
                    Te = (Te + 2) & -1;
                };
            }
            if ((gf & 0xfffc) == 0) {
                interuption(13, 0);
            } else {
                if ((gf & 3) != He) interuption(13, gf & 0xfffc);
                e = Xd(gf);
                if (!e) interuption(13, gf & 0xfffc);
                we = e[0];
                xe = e[1];
                if (! (xe & (1 << 12)) || (xe & (1 << 11)) || !(xe & (1 << 9))) interuption(13, gf & 0xfffc);
                he = (xe >> 13) & 3;
                if (he != He) interuption(13, gf & 0xfffc);
                if (! (xe & (1 << 15))) interuption(11, gf & 0xfffc);
                UpdateRegister8086(2, gf, ae(we, xe), Zd(we, xe), xe);
            }
            UpdateRegister8086(1, Ke, ae(Yd, Wd), Zd(Yd, Wd), Wd);
            rd(He);
            Te = wd;
            Pa = Vd(xe);
            Pe(0, He);
            Pe(3, He);
            Pe(4, He);
            Pe(5, He);
            Te = (Te + cf) & -1;
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Te) & Pa);
        EIPDword = Le,
        EIPDbyte = Mb = 0;
        if (bf) {
            ef = 0x00000100 | 0x00040000 | 0x00200000 | 0x00010000 | 0x00004000;
            if (se == 0) ef |= 0x00003000;
            Sa = (alias_CPU_X86.eflags >> 12) & 3;
            if (se <= Sa) ef |= 0x00000200;
            if (je == 0) ef &= 0xffff;
            kd(df, ef);
        }
    }
    function mf(je) {
        var Sa;
        if (! (alias_CPU_X86.cr0 & (1 << 0)) || (alias_CPU_X86.eflags & 0x00020000)) {
            if (alias_CPU_X86.eflags & 0x00020000) {
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (Sa != 3) Interrupt(13);
            }
            af(je, 1, 0);
        } else {
            if (alias_CPU_X86.eflags & 0x00004000) {
                throw "unsupported task gate";
            } else {
                ff(je, 1, 0);
            }
        }
    }
    function nf(je, cf) {
        if (! (alias_CPU_X86.cr0 & (1 << 0)) || (alias_CPU_X86.eflags & 0x00020000)) {
            af(je, 0, cf);
        } else {
            ff(je, 0, cf);
        }
    }
    function of(selector, pf) {
        var e, Yd, Wd, He, he, se, ie;
        if ((selector & 0xfffc) == 0) return null;
        e = Xd(selector);
        if (!e) return null;
        Yd = e[0];
        Wd = e[1];
        He = selector & 3;
        he = (Wd >> 13) & 3;
        se = alias_CPU_X86.cpl;
        if (Wd & (1 << 12)) {
            if ((Wd & (1 << 11)) && (Wd & (1 << 10))) {} else {
                if (he < se || he < He) return null;
            }
        } else {
            ie = (Wd >> 8) & 0xf;
            switch (ie) {
            case 1:
            case 2:
            case 3:
            case 9:
            case 11:
                break;
            case 4:
            case 5:
            case 12:
                if (pf) return null;
                break;
            default:
                return null;
            }
            if (he < se || he < He) return null;
        }
        if (pf) {
            return Zd(Yd, Wd);
        } else {
            return Wd & 0x00f0ff00;
        }
    }
    function qf(je, pf) {
        var data, ModRM, RegIndex, selector;
        if (! (alias_CPU_X86.cr0 & (1 << 0)) || (alias_CPU_X86.eflags & 0x00020000)) Interrupt(6);
        ModRM = alias_phys_mem8[EIPDbyte++];;
        RegIndex = (ModRM >> 3) & 7;
        if ((ModRM >> 6) == 3) {
            selector = Registers[ModRM & 7] & 0xffff;
        } else {
            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
            selector = ReadShortFromVaddrReadOnly();
        }
        data = of(selector, pf);
        SRC = CalculateEFL();
        if (data === null) {
            SRC &= ~0x0040;
        } else {
            SRC |= 0x0040;
            if (je) Registers[RegIndex] = data;
            else UpdateAx(RegIndex, data);
        }
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
    }
    function rf(selector, ud) {
        var e, Yd, Wd, He, he, se;
        if ((selector & 0xfffc) == 0) return 0;
        e = Xd(selector);
        if (!e) return 0;
        Yd = e[0];
        Wd = e[1];
        if (! (Wd & (1 << 12))) return 0;
        He = selector & 3;
        he = (Wd >> 13) & 3;
        se = alias_CPU_X86.cpl;
        if (Wd & (1 << 11)) {
            if (ud) {
                return 0;
            } else {
                if (! (Wd & (1 << 9))) return 1;
                if (! (Wd & (1 << 10))) {
                    if (he < se || he < He) return 0;
                }
            }
        } else {
            if (he < se || he < He) return 0;
            if (ud && !(Wd & (1 << 9))) return 0;
        }
        return 1;
    }
    function sf(selector, ud) {
        var z;
        z = rf(selector, ud);
        SRC = CalculateEFL();
        if (z) SRC |= 0x0040;
        else SRC &= ~0x0040;
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
    }
    function tf() {
        var ModRM, data, Operand, RMIndex;
        if (! (alias_CPU_X86.cr0 & (1 << 0)) || (alias_CPU_X86.eflags & 0x00020000)) Interrupt(6);
        ModRM = alias_phys_mem8[EIPDbyte++];;
        if ((ModRM >> 6) == 3) {
            RMIndex = ModRM & 7;
            data = Registers[RMIndex] & 0xffff;
        } else {
            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
            data = ReadShortFromVaddrReadWrite();
        }
        Operand = Registers[(ModRM >> 3) & 7];
        SRC = CalculateEFL();
        if ((data & 3) < (Operand & 3)) {
            data = (data & ~3) | (Operand & 3);
            if ((ModRM >> 6) == 3) {
                UpdateAx(RMIndex, data);
            } else {
                WriteShortToVaddr(data);
            }
            SRC |= 0x0040;
        } else {
            SRC &= ~0x0040;
        }
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
    }
    function uf() {
        var Rb;
        Rb = Registers[EAXIndex];
        switch (Rb) {
        case 0:
            Registers[EAXIndex] = 1;
            Registers[EBXIndex] = 0x756e6547 & -1;
            Registers[EDXIndex] = 0x49656e69 & -1;
            Registers[ECXIndex] = 0x6c65746e & -1;
            break;
        case 1:
        default:
            Registers[EAXIndex] = (5 << 8) | (4 << 4) | 3;
            Registers[EBXIndex] = 8 << 8;
            Registers[ECXIndex] = 0;
            Registers[EDXIndex] = (1 << 4);
            break;
        }
    }
    function vf(base) {
        var wf, xf;
        if (base == 0) Interrupt(0);
        wf = Registers[EAXIndex] & 0xff;
        xf = (wf / base) & -1;
        wf = (wf % base);
        Registers[EAXIndex] = (Registers[EAXIndex] & ~0xffff) | wf | (xf << 8);
        ZeroFlag = (((wf) << 24) >> 24);
        OP = 12;
    }
    function yf(base) {
        var wf, xf;
        wf = Registers[EAXIndex] & 0xff;
        xf = (Registers[EAXIndex] >> 8) & 0xff;
        wf = (xf * base + wf) & 0xff;
        Registers[EAXIndex] = (Registers[EAXIndex] & ~0xffff) | wf;
        ZeroFlag = (((wf) << 24) >> 24);
        OP = 12;
    }
    function zf() {
        var Af, wf, xf, Bf, jd;
        jd = CalculateEFL();
        Bf = jd & 0x0010;
        wf = Registers[EAXIndex] & 0xff;
        xf = (Registers[EAXIndex] >> 8) & 0xff;
        Af = (wf > 0xf9);
        if (((wf & 0x0f) > 9) || Bf) {
            wf = (wf + 6) & 0x0f;
            xf = (xf + 1 + Af) & 0xff;
            jd |= 0x0001 | 0x0010;
        } else {
            jd &= ~ (0x0001 | 0x0010);
            wf &= 0x0f;
        }
        Registers[EAXIndex] = (Registers[EAXIndex] & ~0xffff) | wf | (xf << 8);
        SRC = jd;
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
    }
    function Cf() {
        var Af, wf, xf, Bf, jd;
        jd = CalculateEFL();
        Bf = jd & 0x0010;
        wf = Registers[EAXIndex] & 0xff;
        xf = (Registers[EAXIndex] >> 8) & 0xff;
        Af = (wf < 6);
        if (((wf & 0x0f) > 9) || Bf) {
            wf = (wf - 6) & 0x0f;
            xf = (xf - 1 - Af) & 0xff;
            jd |= 0x0001 | 0x0010;
        } else {
            jd &= ~ (0x0001 | 0x0010);
            wf &= 0x0f;
        }
        Registers[EAXIndex] = (Registers[EAXIndex] & ~0xffff) | wf | (xf << 8);
        SRC = jd;
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
    }
    function Df() {
        var wf, Bf, Ef, jd;
        jd = CalculateEFL();
        Ef = jd & 0x0001;
        Bf = jd & 0x0010;
        wf = Registers[EAXIndex] & 0xff;
        jd = 0;
        if (((wf & 0x0f) > 9) || Bf) {
            wf = (wf + 6) & 0xff;
            jd |= 0x0010;
        }
        if ((wf > 0x9f) || Ef) {
            wf = (wf + 0x60) & 0xff;
            jd |= 0x0001;
        }
        Registers[EAXIndex] = (Registers[EAXIndex] & ~0xff) | wf;
        jd |= (wf == 0) << 6;
        jd |= parity_table[wf] << 2;
        jd |= (wf & 0x80);
        SRC = jd;
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
    }
    function Ff() {
        var wf, Gf, Bf, Ef, jd;
        jd = CalculateEFL();
        Ef = jd & 0x0001;
        Bf = jd & 0x0010;
        wf = Registers[EAXIndex] & 0xff;
        jd = 0;
        Gf = wf;
        if (((wf & 0x0f) > 9) || Bf) {
            jd |= 0x0010;
            if (wf < 6 || Ef) jd |= 0x0001;
            wf = (wf - 6) & 0xff;
        }
        if ((Gf > 0x99) || Ef) {
            wf = (wf - 0x60) & 0xff;
            jd |= 0x0001;
        }
        Registers[EAXIndex] = (Registers[EAXIndex] & ~0xff) | wf;
        jd |= (wf == 0) << 6;
        jd |= parity_table[wf] << 2;
        jd |= (wf & 0x80);
        SRC = jd;
        ZeroFlag = ((SRC >> 6) & 1) ^ 1;
        OP = 24;
    }
    function Hf() {
        var ModRM, data, Operand, Operand2;
        ModRM = alias_phys_mem8[EIPDbyte++];;
        if ((ModRM >> 3) == 3) Interrupt(6);
        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
        data = ReadIntFromVaddrReadOnly();
        v_addr = (v_addr + 4) & -1;
        Operand = ReadIntFromVaddrReadOnly();
        RegIndex = (ModRM >> 3) & 7;
        Operand2 = Registers[RegIndex];
        if (Operand2 < data || Operand2 > Operand) Interrupt(5);
    }
    function If() {
        var ModRM, data, Operand, Operand2;
        ModRM = alias_phys_mem8[EIPDbyte++];;
        if ((ModRM >> 3) == 3) Interrupt(6);
        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
        data = (ReadShortFromVaddrReadOnly() << 16) >> 16;
        v_addr = (v_addr + 2) & -1;
        Operand = (ReadShortFromVaddrReadOnly() << 16) >> 16;
        RegIndex = (ModRM >> 3) & 7;
        Operand2 = (Registers[RegIndex] << 16) >> 16;
        if (Operand2 < data || Operand2 > Operand) Interrupt(5);
    }
    function Jf() {
        var data, Operand, RegIndex;
        Operand = (Registers[ESPIndex] - 16) >> 0;
        v_addr = ((Operand & Pa) + Oa) >> 0;
        for (RegIndex = 7; RegIndex >= 0; RegIndex--) {
            data = Registers[RegIndex];
            WriteShortToVaddr(data);
            v_addr = (v_addr + 2) >> 0;
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Operand) & Pa);
    }
    function Kf() {
        var data, Operand, RegIndex;
        Operand = (Registers[ESPIndex] - 32) >> 0;
        v_addr = ((Operand & Pa) + Oa) >> 0;
        for (RegIndex = 7; RegIndex >= 0; RegIndex--) {
            data = Registers[RegIndex];
            WriteIntToVaddr(data);
            v_addr = (v_addr + 4) >> 0;
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Operand) & Pa);
    }
    function Lf() {
        var RegIndex;
        v_addr = ((Registers[ESPIndex] & Pa) + Oa) >> 0;
        for (RegIndex = 7; RegIndex >= 0; RegIndex--) {
            if (RegIndex != 4) {
                UpdateAx(RegIndex, ReadShortFromVaddrReadOnly());
            }
            v_addr = (v_addr + 2) >> 0;
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Registers[ESPIndex] + 16) & Pa);
    }
    function Mf() {
        var RegIndex;
        v_addr = ((Registers[ESPIndex] & Pa) + Oa) >> 0;
        for (RegIndex = 7; RegIndex >= 0; RegIndex--) {
            if (RegIndex != 4) {
                Registers[RegIndex] = ReadIntFromVaddrReadOnly();
            }
            v_addr = (v_addr + 4) >> 0;
        }
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Registers[ESPIndex] + 32) & Pa);
    }
    function Nf() {
        var data, Operand;
        Operand = Registers[EBPIndex];
        v_addr = ((Operand & Pa) + Oa) >> 0;
        data = ReadShortFromVaddrReadOnly();
        UpdateAx(EBPIndex, data);
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Operand + 2) & Pa);
    }
    function Of() {
        var data, Operand;
        Operand = Registers[EBPIndex];
        v_addr = ((Operand & Pa) + Oa) >> 0;
        data = ReadIntFromVaddrReadOnly();
        Registers[EBPIndex] = data;
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Operand + 4) & Pa);
    }
    function Pf() {
        var cf, Qf, le, Rf, data, Sf;
        cf = Ob();
        Qf = alias_phys_mem8[EIPDbyte++];;
        Qf &= 0x1f;
        le = Registers[ESPIndex];
        Rf = Registers[EBPIndex]; {
            le = (le - 2) >> 0;
            v_addr = ((le & Pa) + Oa) >> 0;
            WriteShortToVaddr(Rf);
        };
        Sf = le;
        if (Qf != 0) {
            while (Qf > 1) {
                Rf = (Rf - 2) >> 0;
                v_addr = ((Rf & Pa) + Oa) >> 0;
                data = ReadShortFromVaddrReadOnly(); {
                    le = (le - 2) >> 0;
                    v_addr = ((le & Pa) + Oa) >> 0;
                    WriteShortToVaddr(data);
                };
                Qf--;
            } {
                le = (le - 2) >> 0;
                v_addr = ((le & Pa) + Oa) >> 0;
                WriteShortToVaddr(Sf);
            };
        }
        le = (le - cf) >> 0;
        v_addr = ((le & Pa) + Oa) >> 0;
        ReadShortFromVaddrReadWrite();
        Registers[EBPIndex] = (Registers[EBPIndex] & ~Pa) | (Sf & Pa);
        Registers[ESPIndex] = le;
    }
    function Tf() {
        var cf, Qf, le, Rf, data, Sf;
        cf = Ob();
        Qf = alias_phys_mem8[EIPDbyte++];;
        Qf &= 0x1f;
        le = Registers[ESPIndex];
        Rf = Registers[EBPIndex]; {
            le = (le - 4) >> 0;
            v_addr = ((le & Pa) + Oa) >> 0;
            WriteIntToVaddr(Rf);
        };
        Sf = le;
        if (Qf != 0) {
            while (Qf > 1) {
                Rf = (Rf - 4) >> 0;
                v_addr = ((Rf & Pa) + Oa) >> 0;
                data = ReadIntFromVaddrReadOnly(); {
                    le = (le - 4) >> 0;
                    v_addr = ((le & Pa) + Oa) >> 0;
                    WriteIntToVaddr(data);
                };
                Qf--;
            } {
                le = (le - 4) >> 0;
                v_addr = ((le & Pa) + Oa) >> 0;
                WriteIntToVaddr(Sf);
            };
        }
        le = (le - cf) >> 0;
        v_addr = ((le & Pa) + Oa) >> 0;
        ReadIntFromVaddrReadWrite();
        Registers[EBPIndex] = (Registers[EBPIndex] & ~Pa) | (Sf & Pa);
        Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((le) & Pa);
    }
    function LoadSelectorFromFarPointer48IntoSegRegister(SegRegIndex) {
        var offset, Selector, ModRM;

        ModRM = alias_phys_mem8[EIPDbyte++];;
        if ((ModRM >> 3) == 3)
			Interrupt(6);

        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
        offset = ReadIntFromVaddrReadOnly();
        v_addr += 4;
        Selector = ReadShortFromVaddrReadOnly();

        LoadSelectorIntoSegRegister(SegRegIndex, Selector);
        Registers[(ModRM >> 3) & 7] = offset;
    }
    function LoadSelectorFromFarPointer32IntoSegRegister(SegRegIndex) {
        var offset, Selector, ModRM;

        ModRM = alias_phys_mem8[EIPDbyte++];;
        if ((ModRM >> 3) == 3)
			Interrupt(6);

        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
        offset = ReadShortFromVaddrReadOnly();
        v_addr += 2;
        Selector = ReadShortFromVaddrReadOnly();

        LoadSelectorIntoSegRegister(SegRegIndex, Selector);
        UpdateAx((ModRM >> 3) & 7, offset);
    }
    function Wf() {
        var Xf, Yf, Zf, ag, Sa, data;
        Sa = (alias_CPU_X86.eflags >> 12) & 3;
        if (alias_CPU_X86.cpl > Sa) Interrupt(13);
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        Zf = Registers[EDXIndex] & 0xffff;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = alias_CPU_X86.ld8_port(Zf);
            v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
            WriteByteToVaddr(data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = alias_CPU_X86.ld8_port(Zf);
            v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
            WriteByteToVaddr(data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
        }
    }
    function bg() {
        var Xf, cg, SegRegIndex, ag, Zf, Sa, data;
        Sa = (alias_CPU_X86.eflags >> 12) & 3;
        if (alias_CPU_X86.cpl > Sa) Interrupt(13);
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Zf = Registers[EDXIndex] & 0xffff;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            data = ReadByteFromVaddrReadOnly();
            alias_CPU_X86.st8_port(Zf, data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            data = ReadByteFromVaddrReadOnly();
            alias_CPU_X86.st8_port(Zf, data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
        }
    }
    function dg() {
        var Xf, Yf, cg, ag, SegRegIndex, eg;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Yf = Registers[EDIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        eg = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;; {
                data = ReadByteFromVaddrReadOnly();
                v_addr = eg;
                WriteByteToVaddr(data);
                Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
                Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
                Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
                if (ag & Xf) EIPDbyte = Mb;;
            }
        } else {
            data = ReadByteFromVaddrReadOnly();
            v_addr = eg;
            WriteByteToVaddr(data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
        }
    }
    function fg() {
        var Xf, Yf, ag;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;; {
                WriteByteToVaddr(Registers[EAXIndex]);
                Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
                Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
                if (ag & Xf) EIPDbyte = Mb;;
            }
        } else {
            WriteByteToVaddr(Registers[EAXIndex]);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
        }
    }
    function gg() {
        var Xf, Yf, cg, ag, SegRegIndex, eg;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Yf = Registers[EDIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        eg = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadByteFromVaddrReadOnly();
            v_addr = eg;
            Operand = ReadByteFromVaddrReadOnly();
            GroupCommand(7, data, Operand);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (Da & 0x0010) {
                if (! (ZeroFlag == 0)) return;
            } else {
                if ((ZeroFlag == 0)) return;
            }
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadByteFromVaddrReadOnly();
            v_addr = eg;
            Operand = ReadByteFromVaddrReadOnly();
            GroupCommand(7, data, Operand);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
        }
    }
    function hg() {
        var Xf, cg, SegRegIndex, ag, data;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadByteFromVaddrReadOnly();
            Registers[EAXIndex] = (Registers[EAXIndex] & -256) | data;
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadByteFromVaddrReadOnly();
            Registers[EAXIndex] = (Registers[EAXIndex] & -256) | data;
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 0)) & Xf);
        }
    }
    function ig() {
        var Xf, Yf, ag, data;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadByteFromVaddrReadOnly();
            GroupCommand(7, Registers[EAXIndex], data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (Da & 0x0010) {
                if (! (ZeroFlag == 0)) return;
            } else {
                if ((ZeroFlag == 0)) return;
            }
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadByteFromVaddrReadOnly();
            GroupCommand(7, Registers[EAXIndex], data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 0)) & Xf);
        }
    }
    function jg() {
        var Xf, Yf, Zf, ag, Sa, data;
        Sa = (alias_CPU_X86.eflags >> 12) & 3;
        if (alias_CPU_X86.cpl > Sa) Interrupt(13);
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        Zf = Registers[EDXIndex] & 0xffff;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = alias_CPU_X86.ld16_port(Zf);
            v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
            WriteShortToVaddr(data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = alias_CPU_X86.ld16_port(Zf);
            v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
            WriteShortToVaddr(data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
        }
    }
    function kg() {
        var Xf, cg, SegRegIndex, ag, Zf, Sa, data;
        Sa = (alias_CPU_X86.eflags >> 12) & 3;
        if (alias_CPU_X86.cpl > Sa) Interrupt(13);
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Zf = Registers[EDXIndex] & 0xffff;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            data = ReadShortFromVaddrReadOnly();
            alias_CPU_X86.st16_port(Zf, data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            data = ReadShortFromVaddrReadOnly();
            alias_CPU_X86.st16_port(Zf, data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
        }
    }
    function lg() {
        var Xf, Yf, cg, ag, SegRegIndex, eg;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Yf = Registers[EDIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        eg = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;; {
                data = ReadShortFromVaddrReadOnly();
                v_addr = eg;
                WriteShortToVaddr(data);
                Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
                Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
                Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
                if (ag & Xf) EIPDbyte = Mb;;
            }
        } else {
            data = ReadShortFromVaddrReadOnly();
            v_addr = eg;
            WriteShortToVaddr(data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
        }
    }
    function mg() {
        var Xf, Yf, ag;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;; {
                WriteShortToVaddr(Registers[EAXIndex]);
                Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
                Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
                if (ag & Xf) EIPDbyte = Mb;;
            }
        } else {
            WriteShortToVaddr(Registers[EAXIndex]);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
        }
    }
    function ng() {
        var Xf, Yf, cg, ag, SegRegIndex, eg;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Yf = Registers[EDIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        eg = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadShortFromVaddrReadOnly();
            v_addr = eg;
            Operand = ReadShortFromVaddrReadOnly();
            dc(7, data, Operand);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (Da & 0x0010) {
                if (! (ZeroFlag == 0)) return;
            } else {
                if ((ZeroFlag == 0)) return;
            }
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadShortFromVaddrReadOnly();
            v_addr = eg;
            Operand = ReadShortFromVaddrReadOnly();
            dc(7, data, Operand);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
        }
    }
    function og() {
        var Xf, cg, SegRegIndex, ag, data;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadShortFromVaddrReadOnly();
            Registers[EAXIndex] = (Registers[EAXIndex] & -65536) | data;
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadShortFromVaddrReadOnly();
            Registers[EAXIndex] = (Registers[EAXIndex] & -65536) | data;
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 1)) & Xf);
        }
    }
    function pg() {
        var Xf, Yf, ag, data;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadShortFromVaddrReadOnly();
            dc(7, Registers[EAXIndex], data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (Da & 0x0010) {
                if (! (ZeroFlag == 0)) return;
            } else {
                if ((ZeroFlag == 0)) return;
            }
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadShortFromVaddrReadOnly();
            dc(7, Registers[EAXIndex], data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 1)) & Xf);
        }
    }
    function qg() {
        var Xf, Yf, Zf, ag, Sa, data;
        Sa = (alias_CPU_X86.eflags >> 12) & 3;
        if (alias_CPU_X86.cpl > Sa) Interrupt(13);
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        Zf = Registers[EDXIndex] & 0xffff;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = alias_CPU_X86.ld32_port(Zf);
            v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
            WriteIntToVaddr(data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = alias_CPU_X86.ld32_port(Zf);
            v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
            WriteIntToVaddr(data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
        }
    }
    function rg() {
        var Xf, cg, SegRegIndex, ag, Zf, Sa, data;
        Sa = (alias_CPU_X86.eflags >> 12) & 3;
        if (alias_CPU_X86.cpl > Sa) Interrupt(13);
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Zf = Registers[EDXIndex] & 0xffff;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            data = ReadIntFromVaddrReadOnly();
            alias_CPU_X86.st32_port(Zf, data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
            data = ReadIntFromVaddrReadOnly();
            alias_CPU_X86.st32_port(Zf, data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
        }
    }
    function sg() {
        var Xf, Yf, cg, ag, SegRegIndex, eg;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Yf = Registers[EDIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        eg = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            if (Xf == -1 && alias_CPU_X86.df == 1 && ((v_addr | eg) & 3) == 0) {
                var tg, l, ug, vg, i, wg;
                tg = ag >>> 0;
                l = (4096 - (v_addr & 0xfff)) >> 2;
                if (tg > l) tg = l;
                l = (4096 - (eg & 0xfff)) >> 2;
                if (tg > l) tg = l;
                ug = td(v_addr, 0);
                vg = td(eg, 1);
                wg = tg << 2;
                vg >>= 2;
                ug >>= 2;
                for (i = 0; i < tg; i++) alias_phys_mem32[vg + i] = alias_phys_mem32[ug + i];
                Registers[ESIIndex] = (cg + wg) >> 0;
                Registers[EDIIndex] = (Yf + wg) >> 0;
                Registers[ECXIndex] = ag = (ag - tg) >> 0;
                if (ag) EIPDbyte = Mb;
            } else {
                data = ReadIntFromVaddrReadOnly();
                v_addr = eg;
                WriteIntToVaddr(data);
                Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
                Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
                Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
                if (ag & Xf) EIPDbyte = Mb;;
            }
        } else {
            data = ReadIntFromVaddrReadOnly();
            v_addr = eg;
            WriteIntToVaddr(data);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
        }
    }
    function xg() {
        var Xf, Yf, ag;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            if (Xf == -1 && alias_CPU_X86.df == 1 && (v_addr & 3) == 0) {
                var tg, l, vg, i, wg, data;
                tg = ag >>> 0;
                l = (4096 - (v_addr & 0xfff)) >> 2;
                if (tg > l) tg = l;
                vg = td(Registers[EDIIndex], 1);
                data = Registers[EAXIndex];
                vg >>= 2;
                for (i = 0; i < tg; i++) alias_phys_mem32[vg + i] = data;
                wg = tg << 2;
                Registers[EDIIndex] = (Yf + wg) >> 0;
                Registers[ECXIndex] = ag = (ag - tg) >> 0;
                if (ag) EIPDbyte = Mb;
            } else {
                WriteIntToVaddr(Registers[EAXIndex]);
                Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
                Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
                if (ag & Xf) EIPDbyte = Mb;;
            }
        } else {
            WriteIntToVaddr(Registers[EAXIndex]);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
        }
    }
    function yg() {
        var Xf, Yf, cg, ag, SegRegIndex, eg;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        Yf = Registers[EDIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        eg = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadIntFromVaddrReadOnly();
            v_addr = eg;
            Operand = ReadIntFromVaddrReadOnly();
            GroupCommand2(7, data, Operand);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (Da & 0x0010) {
                if (! (ZeroFlag == 0)) return;
            } else {
                if ((ZeroFlag == 0)) return;
            }
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadIntFromVaddrReadOnly();
            v_addr = eg;
            Operand = ReadIntFromVaddrReadOnly();
            GroupCommand2(7, data, Operand);
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
        }
    }
    function zg() {
        var Xf, cg, SegRegIndex, ag, data;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        SegRegIndex = Da & 0x000f;
        if (SegRegIndex == 0) SegRegIndex = 3;
        else SegRegIndex--;
        cg = Registers[ESIIndex];
        v_addr = ((cg & Xf) + alias_CPU_X86.SegDescriptors[SegRegIndex].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadIntFromVaddrReadOnly();
            Registers[EAXIndex] = data;
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadIntFromVaddrReadOnly();
            Registers[EAXIndex] = data;
            Registers[ESIIndex] = (cg & ~Xf) | ((cg + (alias_CPU_X86.df << 2)) & Xf);
        }
    }
    function Ag() {
        var Xf, Yf, ag, data;
        if (Da & 0x0080) Xf = 0xffff;
        else Xf = -1;
        Yf = Registers[EDIIndex];
        v_addr = ((Yf & Xf) + alias_CPU_X86.SegDescriptors[0].base) >> 0;
        if (Da & (0x0010 | 0x0020)) {
            ag = Registers[ECXIndex];
            if ((ag & Xf) == 0) return;;
            data = ReadIntFromVaddrReadOnly();
            GroupCommand2(7, Registers[EAXIndex], data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
            Registers[ECXIndex] = ag = (ag & ~Xf) | ((ag - 1) & Xf);
            if (Da & 0x0010) {
                if (! (ZeroFlag == 0)) return;
            } else {
                if ((ZeroFlag == 0)) return;
            }
            if (ag & Xf) EIPDbyte = Mb;;
        } else {
            data = ReadIntFromVaddrReadOnly();
            GroupCommand2(7, Registers[EAXIndex], data);
            Registers[EDIIndex] = (Yf & ~Xf) | ((Yf + (alias_CPU_X86.df << 2)) & Xf);
        }
    }
    alias_CPU_X86 = this;
    alias_phys_mem8 = this.phys_mem8;
    alias_phys_mem16 = this.phys_mem16;
    alias_phys_mem32 = this.phys_mem32;
    alias_tlb_read_user = this.tlb_read_user;
    alias_tlb_write_user = this.tlb_write_user;
    alias_tlb_read_kernel = this.tlb_read_kernel;
    alias_tlb_write_kernel = this.tlb_write_kernel;
    if (alias_CPU_X86.cpl == 3) {
        alias_tlb_read = alias_tlb_read_user;
        alias_tlb_write = alias_tlb_write_user;
    } else {
        alias_tlb_read = alias_tlb_read_kernel;
        alias_tlb_write = alias_tlb_write_kernel;
    }
    if (alias_CPU_X86.halted) {
        if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) {
            alias_CPU_X86.halted = 0;
        } else {
            return 257;//hlt
        }
    }
    Registers = this.regs;
    SRC = this.cc_src;
    ZeroFlag = this.cc_dst;
    OP = this.cc_op;
    OP2 = this.cc_op2;
    DST2 = this.cc_dst2;
    EIPDword = this.eip;
    ce();
    ErrorCode = 256;
    Ka = ua;
    if (va) {;
        Ae(va.intno, 0, va.error_code, 0, 0);
    }
    if (alias_CPU_X86.hard_intno >= 0) {;
        Ae(alias_CPU_X86.hard_intno, 0, 0, 0, 1);
        alias_CPU_X86.hard_intno = -1;
    }
    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) {
        alias_CPU_X86.hard_intno = alias_CPU_X86.get_hard_intno();;
        Ae(alias_CPU_X86.hard_intno, 0, 0, 0, 1);
        alias_CPU_X86.hard_intno = -1;
    }
    EIPDbyte = 0;
    Mb = 0;
    Bg: do {;
        EIPDword = (EIPDword + EIPDbyte - Mb) >> 0;
        Nb = (EIPDword + Na) >> 0;
        Lb = alias_tlb_read[Nb >>> 12];
        if (((Lb | Nb) & 0xfff) >= (4096 - 15 + 1)) {
            var Cg;
            if (Lb == -1) LoadMissingVaddrIntoPageTable(Nb, 0, alias_CPU_X86.cpl == 3);
            Lb = alias_tlb_read[Nb >>> 12];
            Mb = EIPDbyte = Nb ^ Lb;
            CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
            Cg = Nb & 0xfff;
            if (Cg >= (4096 - 15 + 1)) {
                data = Cd(Nb, CurrentByteOfCodeSeg);
                if ((Cg + data) > 4096) {
                    Mb = EIPDbyte = this.mem_size;
                    for (Operand = 0; Operand < data; Operand++) {
                        v_addr = (Nb + Operand) >> 0;
                        alias_phys_mem8[EIPDbyte + Operand] = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    }
                    EIPDbyte++;
                }
            }
        } else {
            Mb = EIPDbyte = Nb ^ Lb;
            CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
        }

		od();

        CurrentByteOfCodeSeg |= (Da = Ra) & 0x0100;
		instruction_op = CurrentByteOfCodeSeg;

        Start: for (;;) {
		
            switch (CurrentByteOfCodeSeg) {
            case 0x66: //Operand Size prefix 
                if (Da == Ra) Cd(Nb, CurrentByteOfCodeSeg);
                if (Ra & 0x0100) Da &= ~0x0100;
                else Da |= 0x0100;
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg |= (Da & 0x0100);
                break;
            case 0x67: //Address Size prefix 
                if (Da == Ra) Cd(Nb, CurrentByteOfCodeSeg);
                if (Ra & 0x0080) Da &= ~0x0080;
                else Da |= 0x0080;
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg |= (Da & 0x0100);
                break;
            case 0xf0: //LOCK prefix 
                if (Da == Ra) Cd(Nb, CurrentByteOfCodeSeg);
                Da |= 0x0040;
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg |= (Da & 0x0100);
                break;
            case 0xf2: //REPNE XACQUIRE (Prefix) 
                if (Da == Ra) Cd(Nb, CurrentByteOfCodeSeg);
                Da |= 0x0020;
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg |= (Da & 0x0100);
                break;
            case 0xf3: //REP/REPE XRELEASE (Prefix) 
                if (Da == Ra) Cd(Nb, CurrentByteOfCodeSeg);
                Da |= 0x0010;
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg |= (Da & 0x0100);
                break;
            case 0x26:
            case 0x2e:
            case 0x36:
            case 0x3e:
                if (Da == Ra) Cd(Nb, CurrentByteOfCodeSeg);
                Da = (Da & ~0x000f) | (((CurrentByteOfCodeSeg >> 3) & 3) + 1);
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg |= (Da & 0x0100);;
                break;
            case 0x64:
            case 0x65:
                if (Da == Ra) Cd(Nb, CurrentByteOfCodeSeg);
                Da = (Da & ~0x000f) | ((CurrentByteOfCodeSeg & 7) + 1);
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg |= (Da & 0x0100);;
                break;
            case 0xb0:
            case 0xb1:
            case 0xb2:
            case 0xb3:
            case 0xb4:
            case 0xb5:
            case 0xb6:
            case 0xb7: //mov
                data = alias_phys_mem8[EIPDbyte++];;
                CurrentByteOfCodeSeg &= 7;
                value = (CurrentByteOfCodeSeg & 4) << 1;
                Registers[CurrentByteOfCodeSeg & 3] = (Registers[CurrentByteOfCodeSeg & 3] & ~ (0xff << value)) | (((data) & 0xff) << value);
                break Start;
            case 0xb8:
            case 0xb9:
            case 0xba:
            case 0xbb:
            case 0xbc:
            case 0xbd:
            case 0xbe:
            case 0xbf: //mov
                {
                    data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                Registers[CurrentByteOfCodeSeg & 7] = data;
                break Start;
            case 0x88: //mov
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                data = (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1));
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    value = (RMIndex & 4) << 1;
                    Registers[RMIndex & 3] = (Registers[RMIndex & 3] & ~ (0xff << value)) | (((data) & 0xff) << value);
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM); {
                        value = alias_tlb_write[v_addr >>> 12];
                        if (value == -1) {
                            ProcessMemoryException(data);
                        } else {
                            alias_phys_mem8[v_addr ^ value] = data;
                        }
                    };
                }
                break Start;
            case 0x89: //mov
                ModRM = alias_phys_mem8[EIPDbyte++];;
                data = Registers[(ModRM >> 3) & 7];
                if ((ModRM >> 6) == 3) {
                    Registers[ModRM & 7] = data;
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM); {
                        value = alias_tlb_write[v_addr >>> 12];
						
						//check if addree is alighned
                        if ((value | v_addr) & 3) {
                            WriteIntToUnalignedVaddr(data);
                        } else {
                            alias_phys_mem32[(v_addr ^ value) >> 2] = data;
                        }
                    };
                }
                break Start;
            case 0x8a: //mov
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                }
                RegIndex = (ModRM >> 3) & 7;
                value = (RegIndex & 4) << 1;
                Registers[RegIndex & 3] = (Registers[RegIndex & 3] & ~ (0xff << value)) | (((data) & 0xff) << value);
                break Start;
            case 0x8b: //mov
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) {
                    data = Registers[ModRM & 7];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = (((value = alias_tlb_read[v_addr >>> 12]) | v_addr) & 3 ? ReadIntFromUnalignedVaddrReadOnly() : alias_phys_mem32[(v_addr ^ value) >> 2]);
                }
                Registers[(ModRM >> 3) & 7] = data;
                break Start;
            case 0xa0: //mov
                v_addr = SegRegisterIndexnerateIndirectAddressWithMoffset();
                data = ReadByteFromVaddrReadOnly();
                Registers[EAXIndex] = (Registers[EAXIndex] & -256) | data;
                break Start;
            case 0xa1: //mov
                v_addr = SegRegisterIndexnerateIndirectAddressWithMoffset();
                data = ReadIntFromVaddrReadOnly();
                Registers[EAXIndex] = data;
                break Start;
            case 0xa2: //mov
                v_addr = SegRegisterIndexnerateIndirectAddressWithMoffset();
                WriteByteToVaddr(Registers[EAXIndex]);
                break Start;
            case 0xa3: //mov
                v_addr = SegRegisterIndexnerateIndirectAddressWithMoffset();
                WriteIntToVaddr(Registers[EAXIndex]);
                break Start;
            case 0xd7: //XLAT
                v_addr = (Registers[EBXIndex] + (Registers[EAXIndex] & 0xff)) >> 0;
                if (Da & 0x0080) v_addr &= 0xffff;
                RegIndex = Da & 0x000f;
                if (RegIndex == 0) RegIndex = 3;
                else RegIndex--;
                v_addr = (v_addr + alias_CPU_X86.SegDescriptors[RegIndex].base) >> 0;
                data = ReadByteFromVaddrReadOnly();
                UpdateAlOrAh(0, data);
                break Start;
            case 0xc6: //mov
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) {
                    data = alias_phys_mem8[EIPDbyte++];;
                    UpdateAlOrAh(ModRM & 7, data);
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = alias_phys_mem8[EIPDbyte++];;
                    WriteByteToVaddr(data);
                }
                break Start;
            case 0xc7: //mov
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) {
                    {
                        data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    };
                    Registers[ModRM & 7] = data;
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM); {
                        data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    };
                    WriteIntToVaddr(data);
                }
                break Start;
            case 0x91:
            case 0x92:
            case 0x93:
            case 0x94:
            case 0x95:
            case 0x96:
            case 0x97: //xchg
                RegIndex = CurrentByteOfCodeSeg & 7;
                data = Registers[EAXIndex];
                Registers[EAXIndex] = Registers[RegIndex];
                Registers[RegIndex] = data;
                break Start;
            case 0x86: //xchg
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                    UpdateAlOrAh(RMIndex, (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadByteFromVaddrReadWrite();
                    WriteByteToVaddr((Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)));
                }
                UpdateAlOrAh(RegIndex, data);
                break Start;
            case 0x87: //xchg
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    data = Registers[RMIndex];
                    Registers[RMIndex] = Registers[RegIndex];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadWrite();
                    WriteIntToVaddr(Registers[RegIndex]);
                }
                Registers[RegIndex] = data;
                break Start;
            case 0x8e: //mov selector -> segreg
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                if (RegIndex >= 6 || RegIndex == 1) Interrupt(6);
                if ((ModRM >> 6) == 3) {
                    data = Registers[ModRM & 7] & 0xffff;
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadShortFromVaddrReadOnly();
                }
                LoadSelectorIntoSegRegister(RegIndex, data);
                break Start;
            case 0x8c: //mov segreg -> selector
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                if (RegIndex >= 6) Interrupt(6);
                data = alias_CPU_X86.SegDescriptors[RegIndex].selector;
                if ((ModRM >> 6) == 3) {
                    if ((((Da >> 8) & 1) ^ 1)) {
                        Registers[ModRM & 7] = data;
                    } else {
                        UpdateAx(ModRM & 7, data);
                    }
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    WriteShortToVaddr(data);
                }
                break Start;
            case 0xc4: //les
                LoadSelectorFromFarPointer48IntoSegRegister(0);
                break Start;
            case 0xc5: //lds
                LoadSelectorFromFarPointer48IntoSegRegister(3);
                break Start;
            case 0x00: //add //command group
            case 0x08:
            case 0x10:
            case 0x18:
            case 0x20:
            case 0x28:
            case 0x30:
            case 0x38: //cmp
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                RegIndex = (ModRM >> 3) & 7;
                Operand = (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1));
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    UpdateAlOrAh(RMIndex, GroupCommand(CommandIndex, (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)), Operand));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    if (CommandIndex != 7) {
                        data = ReadByteFromVaddrReadWrite();
                        data = GroupCommand(CommandIndex, data, Operand);
                        WriteByteToVaddr(data);
                    } else {
                        data = ReadByteFromVaddrReadOnly();
                        GroupCommand(7, data, Operand);
                    }
                }
                break Start;
            case 0x01: //add
                ModRM = alias_phys_mem8[EIPDbyte++];;
                Operand = Registers[(ModRM >> 3) & 7];
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7; {
                        SRC = Operand;
                        ZeroFlag = Registers[RMIndex] = (Registers[RMIndex] + SRC) >> 0;
                        OP = 2;
                    };
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadWrite(); {
                        SRC = Operand;
                        ZeroFlag = data = (data + SRC) >> 0;
                        OP = 2;
                    };
                    WriteIntToVaddr(data);
                }
                break Start;
            case 0x09: //or //cmd group
            case 0x11:
            case 0x19:
            case 0x21:
            case 0x29:
            case 0x31:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                Operand = Registers[(ModRM >> 3) & 7];
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    Registers[RMIndex] = GroupCommand2(CommandIndex, Registers[RMIndex], Operand);
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadWrite();
                    data = GroupCommand2(CommandIndex, data, Operand);
                    WriteIntToVaddr(data);
                }
                break Start;
            case 0x39: //cmp
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                Operand = Registers[(ModRM >> 3) & 7];
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7; {
                        SRC = Operand;
                        ZeroFlag = (Registers[RMIndex] - SRC) >> 0;
                        OP = 8;
                    };
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadOnly(); {
                        SRC = Operand;
                        ZeroFlag = (data - SRC) >> 0;
                        OP = 8;
                    };
                }
                break Start;
            case 0x02: //group command
            case 0x0a:
            case 0x12:
            case 0x1a:
            case 0x22:
            case 0x2a:
            case 0x32:
            case 0x3a:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    Operand = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = ReadByteFromVaddrReadOnly();
                }
                UpdateAlOrAh(RegIndex, GroupCommand(CommandIndex, (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)), Operand));
                break Start;
            case 0x03: //add
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    Operand = Registers[ModRM & 7];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = ReadIntFromVaddrReadOnly();
                } {
                    SRC = Operand;
                    ZeroFlag = Registers[RegIndex] = (Registers[RegIndex] + SRC) >> 0;
                    OP = 2;
                };
                break Start;
            case 0x0b: //cmd group
            case 0x13:
            case 0x1b:
            case 0x23:
            case 0x2b:
            case 0x33:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    Operand = Registers[ModRM & 7];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = ReadIntFromVaddrReadOnly();
                }
                Registers[RegIndex] = GroupCommand2(CommandIndex, Registers[RegIndex], Operand);
                break Start;
            case 0x3b: //sub
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    Operand = Registers[ModRM & 7];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = ReadIntFromVaddrReadOnly();
                } {
                    SRC = Operand;
                    ZeroFlag = (Registers[RegIndex] - SRC) >> 0;
                    OP = 8;
                };
                break Start;
            case 0x04: //cmd group
            case 0x0c:
            case 0x14:
            case 0x1c:
            case 0x24:
            case 0x2c:
            case 0x34:
            case 0x3c:
                Operand = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                UpdateAlOrAh(0, GroupCommand(CommandIndex, Registers[EAXIndex] & 0xff, Operand));
                break Start;
            case 0x05: //add
                {
                    Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                }; {
                    SRC = Operand;
                    ZeroFlag = Registers[EAXIndex] = (Registers[EAXIndex] + SRC) >> 0;
                    OP = 2;
                };
                break Start;
            case 0x0d: //cmd group
            case 0x15:
            case 0x1d:
            case 0x25:
            case 0x2d:
                {
                    Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                CommandIndex = CurrentByteOfCodeSeg >> 3;
                Registers[EAXIndex] = GroupCommand2(CommandIndex, Registers[EAXIndex], Operand);
                break Start;
            case 0x35: //xor
                {
                    Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                }; {
                    ZeroFlag = Registers[EAXIndex] = Registers[EAXIndex] ^ Operand;
                    OP = 14;
                };
                break Start;
            case 0x3d: //cmp
                {
                    Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                }; {
                    SRC = Operand;
                    ZeroFlag = (Registers[EAXIndex] - SRC) >> 0;
                    OP = 8;
                };
                break Start;
            case 0x80: //cmd grp
            case 0x82:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    Operand = alias_phys_mem8[EIPDbyte++];;
                    UpdateAlOrAh(RMIndex, GroupCommand(CommandIndex, (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)), Operand));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = alias_phys_mem8[EIPDbyte++];;
                    if (CommandIndex != 7) {
                        data = ReadByteFromVaddrReadWrite();
                        data = GroupCommand(CommandIndex, data, Operand);
                        WriteByteToVaddr(data);
                    } else {
                        data = ReadByteFromVaddrReadOnly();
                        GroupCommand(7, data, Operand);
                    }
                }
                break Start;
            case 0x81: //cmd grp
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                if (CommandIndex == 7) {
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    } {
                        Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    }; {
                        SRC = Operand;
                        ZeroFlag = (data - SRC) >> 0;
                        OP = 8;
                    };
                } else {
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7; {
                            Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                            EIPDbyte += 4;
                        };
                        Registers[RMIndex] = GroupCommand2(CommandIndex, Registers[RMIndex], Operand);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM); {
                            Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                            EIPDbyte += 4;
                        };
                        data = ReadIntFromVaddrReadWrite();
                        data = GroupCommand2(CommandIndex, data, Operand);
                        WriteIntToVaddr(data);
                    }
                }
                break Start;
            case 0x83: //cmd grp
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                if (CommandIndex == 7) {
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    Operand = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);; {
                        SRC = Operand;
                        ZeroFlag = (data - SRC) >> 0;
                        OP = 8;
                    };
                } else {
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Operand = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                        Registers[RMIndex] = GroupCommand2(CommandIndex, Registers[RMIndex], Operand);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                        data = ReadIntFromVaddrReadWrite();
                        data = GroupCommand2(CommandIndex, data, Operand);
                        WriteIntToVaddr(data);
                    }
                }
                break Start;
            case 0x40: //inc
            case 0x41:
            case 0x42:
            case 0x43:
            case 0x44:
            case 0x45:
            case 0x46:
            case 0x47:
                RegIndex = CurrentByteOfCodeSeg & 7; {
                    if (OP < 25) {
                        OP2 = OP;
                        DST2 = ZeroFlag;
                    }
                    Registers[RegIndex] = ZeroFlag = (Registers[RegIndex] + 1) >> 0;
                    OP = 27;
                };
                break Start;
            case 0x48: //dec
            case 0x49:
            case 0x4a:
            case 0x4b:
            case 0x4c:
            case 0x4d:
            case 0x4e:
            case 0x4f:
                RegIndex = CurrentByteOfCodeSeg & 7; {
                    if (OP < 25) {
                        OP2 = OP;
                        DST2 = ZeroFlag;
                    }
                    Registers[RegIndex] = ZeroFlag = (Registers[RegIndex] - 1) >> 0;
                    OP = 30;
                };
                break Start;
            case 0x6b: //imul
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    Operand = Registers[ModRM & 7];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = ReadIntFromVaddrReadOnly();
                }
                Operand2 = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                Registers[RegIndex] = SignedMul(Operand, Operand2);
                break Start;
            case 0x69: //imul
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    Operand = Registers[ModRM & 7];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = ReadIntFromVaddrReadOnly();
                } {
                    Operand2 = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                Registers[RegIndex] = SignedMul(Operand, Operand2);
                break Start;
            case 0x84: //test
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadByteFromVaddrReadOnly();
                }
                RegIndex = (ModRM >> 3) & 7;
                Operand = (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)); {
                    ZeroFlag = (((data & Operand) << 24) >> 24);
                    OP = 12;
                };
                break Start;
            case 0x85: //test
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) {
                    data = Registers[ModRM & 7];
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadOnly();
                }
                Operand = Registers[(ModRM >> 3) & 7]; {
                    ZeroFlag = data & Operand;
                    OP = 14;
                };
                break Start;
            case 0xa8: //test
                Operand = alias_phys_mem8[EIPDbyte++];; {
                    ZeroFlag = (((Registers[EAXIndex] & Operand) << 24) >> 24);
                    OP = 12;
                };
                break Start;
            case 0xa9: //test
                {
                    Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                }; {
                    ZeroFlag = Registers[EAXIndex] & Operand;
                    OP = 14;
                };
                break Start;
            case 0xf6: //2536 grp cmd
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                switch (CommandIndex) {
                case 0:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadOnly();
                    }
                    Operand = alias_phys_mem8[EIPDbyte++];; {
                        ZeroFlag = (((data & Operand) << 24) >> 24);
                        OP = 12;
                    };
                    break;
                case 2:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        UpdateAlOrAh(RMIndex, ~ (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadWrite();
                        data = ~data;
                        WriteByteToVaddr(data);
                    }
                    break;
                case 3:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        UpdateAlOrAh(RMIndex, GroupCommand(5, 0, (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1))));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadWrite();
                        data = GroupCommand(5, 0, data);
                        WriteByteToVaddr(data);
                    }
                    break;
                case 4:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadOnly();
                    }
                    UpdateAx(EAXIndex, Oc(Registers[EAXIndex], data));
                    break;
                case 5:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadOnly();
                    }
                    UpdateAx(EAXIndex, Pc(Registers[EAXIndex], data));
                    break;
                case 6:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadOnly();
                    }
                    UnsignedShortDivide(data);
                    break;
                case 7:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadOnly();
                    }
                    SignedShortDivide(data);
                    break;
                default:
                    Interrupt(6);
                }
                break Start;
            case 0xf7: //grp cmd
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                switch (CommandIndex) {
                case 0:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    } {
                        Operand = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    }; {
                        ZeroFlag = data & Operand;
                        OP = 14;
                    };
                    break;
                case 2:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Registers[RMIndex] = ~Registers[RMIndex];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite();
                        data = ~data;
                        WriteIntToVaddr(data);
                    }
                    break;
                case 3:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Registers[RMIndex] = GroupCommand2(5, 0, Registers[RMIndex]);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite();
                        data = GroupCommand2(5, 0, data);
                        WriteIntToVaddr(data);
                    }
                    break;
                case 4:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    Registers[EAXIndex] = UnsignedMulWrapper(Registers[EAXIndex], data);
                    Registers[EDXIndex] = ExtrsPartResult;
                    break;
                case 5:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    Registers[EAXIndex] = SignedMul(Registers[EAXIndex], data);
                    Registers[EDXIndex] = ExtrsPartResult;
                    break;
                case 6:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    Registers[EAXIndex] = UnsignedInt64Divide(Registers[EDXIndex], Registers[EAXIndex], data);
                    Registers[EDXIndex] = ExtrsPartResult;
                    break;
                case 7:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    Registers[EAXIndex] = SignedInt64Divide(Registers[EDXIndex], Registers[EAXIndex], data);
                    Registers[EDXIndex] = ExtrsPartResult;
                    break;
                default:
                    Interrupt(6);
                }
                break Start;
            case 0xc0:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    Operand = alias_phys_mem8[EIPDbyte++];;
                    RMIndex = ModRM & 7;
                    UpdateAlOrAh(RMIndex, jc(CommandIndex, (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)), Operand));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = alias_phys_mem8[EIPDbyte++];;
                    data = ReadByteFromVaddrReadWrite();
                    data = jc(CommandIndex, data, Operand);
                    WriteByteToVaddr(data);
                }
                break Start;
            case 0xc1:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    Operand = alias_phys_mem8[EIPDbyte++];;
                    RMIndex = ModRM & 7;
                    Registers[RMIndex] = nc(CommandIndex, Registers[RMIndex], Operand);
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Operand = alias_phys_mem8[EIPDbyte++];;
                    data = ReadIntFromVaddrReadWrite();
                    data = nc(CommandIndex, data, Operand);
                    WriteIntToVaddr(data);
                }
                break Start;
            case 0xd0:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    UpdateAlOrAh(RMIndex, jc(CommandIndex, (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)), 1));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadByteFromVaddrReadWrite();
                    data = jc(CommandIndex, data, 1);
                    WriteByteToVaddr(data);
                }
                break Start;
            case 0xd1:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    Registers[RMIndex] = nc(CommandIndex, Registers[RMIndex], 1);
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadWrite();
                    data = nc(CommandIndex, data, 1);
                    WriteIntToVaddr(data);
                }
                break Start;
            case 0xd2:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                Operand = Registers[ECXIndex] & 0xff;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    UpdateAlOrAh(RMIndex, jc(CommandIndex, (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)), Operand));
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadByteFromVaddrReadWrite();
                    data = jc(CommandIndex, data, Operand);
                    WriteByteToVaddr(data);
                }
                break Start;
            case 0xd3:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                Operand = Registers[ECXIndex] & 0xff;
                if ((ModRM >> 6) == 3) {
                    RMIndex = ModRM & 7;
                    Registers[RMIndex] = nc(CommandIndex, Registers[RMIndex], Operand);
                } else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadWrite();
                    data = nc(CommandIndex, data, Operand);
                    WriteIntToVaddr(data);
                }
                break Start;
            case 0x98:
                Registers[EAXIndex] = (Registers[EAXIndex] << 16) >> 16;
                break Start;
            case 0x99:
                Registers[EDXIndex] = Registers[EAXIndex] >> 31;
                break Start;
            case 0x50:
            case 0x51:
            case 0x52:
            case 0x53:
            case 0x54:
            case 0x55:
            case 0x56:
            case 0x57:
                data = Registers[CurrentByteOfCodeSeg & 7];
                if (Qa) {
                    v_addr = (Registers[ESPIndex] - 4) >> 0; {
                        value = alias_tlb_write[v_addr >>> 12];
                        if ((value | v_addr) & 3) {
                            WriteIntToUnalignedVaddr(data);
                        } else {
                            alias_phys_mem32[(v_addr ^ value) >> 2] = data;
                        }
                    };
                    Registers[ESPIndex] = v_addr;
                } else {
                    xd(data);
                }
                break Start;
            case 0x58:
            case 0x59:
            case 0x5a:
            case 0x5b:
            case 0x5c:
            case 0x5d:
            case 0x5e:
            case 0x5f:
                if (Qa) {
                    v_addr = Registers[ESPIndex];
                    data = (((value = alias_tlb_read[v_addr >>> 12]) | v_addr) & 3 ? ReadIntFromUnalignedVaddrReadOnly() : alias_phys_mem32[(v_addr ^ value) >> 2]);
                    Registers[ESPIndex] = (v_addr + 4) >> 0;
                } else {
                    data = Ad();
                    Bd();
                }
                Registers[CurrentByteOfCodeSeg & 7] = data;
                break Start;
            case 0x60:
                Kf();
                break Start;
            case 0x61:
                Mf();
                break Start;
            case 0x8f:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) {
                    data = Ad();
                    Bd();
                    Registers[ModRM & 7] = data;
                } else {
                    data = Ad();
                    Operand = Registers[ESPIndex];
                    Bd();
                    Operand2 = Registers[ESPIndex];
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    Registers[ESPIndex] = Operand;
                    WriteIntToVaddr(data);
                    Registers[ESPIndex] = Operand2;
                }
                break Start;
            case 0x68:
                {
                    data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                if (Qa) {
                    v_addr = (Registers[ESPIndex] - 4) >> 0;
                    WriteIntToVaddr(data);
                    Registers[ESPIndex] = v_addr;
                } else {
                    xd(data);
                }
                break Start;
            case 0x6a:
                data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                if (Qa) {
                    v_addr = (Registers[ESPIndex] - 4) >> 0;
                    WriteIntToVaddr(data);
                    Registers[ESPIndex] = v_addr;
                } else {
                    xd(data);
                }
                break Start;
            case 0xc8:
                Tf();
                break Start;
            case 0xc9:
                if (Qa) {
                    v_addr = Registers[EBPIndex];
                    data = ReadIntFromVaddrReadOnly();
                    Registers[EBPIndex] = data;
                    Registers[ESPIndex] = (v_addr + 4) >> 0;
                } else {
                    Of();
                }
                break Start;
            case 0x9c:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if ((alias_CPU_X86.eflags & 0x00020000) && Sa != 3) Interrupt(13);
                data = id() & ~ (0x00020000 | 0x00010000);
                if ((((Da >> 8) & 1) ^ 1)) {
                    xd(data);
                } else {
                    vd(data);
                }
                break Start;
            case 0x9d:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if ((alias_CPU_X86.eflags & 0x00020000) && Sa != 3) Interrupt(13);
                if ((((Da >> 8) & 1) ^ 1)) {
                    data = Ad();
                    Bd();
                    Operand = -1;
                } else {
                    data = yd();
                    zd();
                    Operand = 0xffff;
                }
                Operand2 = (0x00000100 | 0x00040000 | 0x00200000 | 0x00004000);
                if (alias_CPU_X86.cpl == 0) {
                    Operand2 |= 0x00000200 | 0x00003000;
                } else {
                    if (alias_CPU_X86.cpl <= Sa) Operand2 |= 0x00000200;
                }
                kd(data, Operand2 & Operand); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0x06:
            case 0x0e:
            case 0x16:
            case 0x1e:
                xd(alias_CPU_X86.SegDescriptors[CurrentByteOfCodeSeg >> 3].selector);
                break Start;
            case 0x07:
            case 0x17:
            case 0x1f:
                LoadSelectorIntoSegRegister(CurrentByteOfCodeSeg >> 3, Ad() & 0xffff);
                Bd();
                break Start;
            case 0x8d:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                if ((ModRM >> 6) == 3) Interrupt(6);
                Da = (Da & ~0x000f) | (6 + 1);
                Registers[(ModRM >> 3) & 7] = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                break Start;
            case 0xfe:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                switch (CommandIndex) {
                case 0:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        UpdateAlOrAh(RMIndex, hc((Registers[RMIndex & 3] >> ((RMIndex & 4) << 1))));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadWrite();
                        data = hc(data);
                        WriteByteToVaddr(data);
                    }
                    break;
                case 1:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        UpdateAlOrAh(RMIndex, ic((Registers[RMIndex & 3] >> ((RMIndex & 4) << 1))));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadWrite();
                        data = ic(data);
                        WriteByteToVaddr(data);
                    }
                    break;
                default:
                    Interrupt(6);
                }
                break Start;
            case 0xff:
                ModRM = alias_phys_mem8[EIPDbyte++];;
                CommandIndex = (ModRM >> 3) & 7;
                switch (CommandIndex) {
                case 0:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7; {
                            if (OP < 25) {
                                OP2 = OP;
                                DST2 = ZeroFlag;
                            }
                            Registers[RMIndex] = ZeroFlag = (Registers[RMIndex] + 1) >> 0;
                            OP = 27;
                        };
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite(); {
                            if (OP < 25) {
                                OP2 = OP;
                                DST2 = ZeroFlag;
                            }
                            data = ZeroFlag = (data + 1) >> 0;
                            OP = 27;
                        };
                        WriteIntToVaddr(data);
                    }
                    break;
                case 1:
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7; {
                            if (OP < 25) {
                                OP2 = OP;
                                DST2 = ZeroFlag;
                            }
                            Registers[RMIndex] = ZeroFlag = (Registers[RMIndex] - 1) >> 0;
                            OP = 30;
                        };
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite(); {
                            if (OP < 25) {
                                OP2 = OP;
                                DST2 = ZeroFlag;
                            }
                            data = ZeroFlag = (data - 1) >> 0;
                            OP = 30;
                        };
                        WriteIntToVaddr(data);
                    }
                    break;
                case 2:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    Operand = (EIPDword + EIPDbyte - Mb);
                    if (Qa) {
                        v_addr = (Registers[ESPIndex] - 4) >> 0;
                        WriteIntToVaddr(Operand);
                        Registers[ESPIndex] = v_addr;
                    } else {
                        xd(Operand);
                    }
                    EIPDword = data,
                    EIPDbyte = Mb = 0;
                    break;
                case 4:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    EIPDword = data,
                    EIPDbyte = Mb = 0;
                    break;
                case 6:
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    if (Qa) {
                        v_addr = (Registers[ESPIndex] - 4) >> 0;
                        WriteIntToVaddr(data);
                        Registers[ESPIndex] = v_addr;
                    } else {
                        xd(data);
                    }
                    break;
                case 3:
                case 5:
                    if ((ModRM >> 6) == 3) Interrupt(6);
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                    data = ReadIntFromVaddrReadOnly();
                    v_addr = (v_addr + 4) >> 0;
                    Operand = ReadShortFromVaddrReadOnly();
                    if (CommandIndex == 3) Ze(1, Operand, data, (EIPDword + EIPDbyte - Mb));
                    else Oe(Operand, data);
                    break;
                default:
                    Interrupt(6);
                }
                break Start;
            case 0xeb:
                data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                EIPDbyte = (EIPDbyte + data) >> 0;
                break Start;
            case 0xe9:
                {
                    data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                EIPDbyte = (EIPDbyte + data) >> 0;
                break Start;
            case 0xea:
                if ((((Da >> 8) & 1) ^ 1)) {
                    {
                        data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    };
                } else {
                    data = Ob();
                }
                Operand = Ob();
                Oe(Operand, data);
                break Start;
            case 0x70://jmp
                if (CheckOverFlow()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x71://jmp
                if (!CheckOverFlow()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x72://jmp
                if (CalculateCarry()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x73://jmp
                if (!CalculateCarry()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x74: //jmp
                if ((ZeroFlag == 0)) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x75:  //jmp
                if (! (ZeroFlag == 0)) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x76://jmp
                if (CalculateCarryOrZeroFlag()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x77://jmp
                if (!CalculateCarryOrZeroFlag()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x78://jmp
                if ((OP == 24 ? ((SRC >> 7) & 1) : (ZeroFlag < 0))) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x79://jmp
                if (! (OP == 24 ? ((SRC >> 7) & 1) : (ZeroFlag < 0))) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x7a:
                if (CalculateParity()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x7b:
                if (!CalculateParity()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x7c:
                if (cd()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x7d:
                if (!cd()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x7e:
                if (dd()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0x7f:
                if (!dd()) {
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDbyte = (EIPDbyte + data) >> 0;
                } else {
                    EIPDbyte = (EIPDbyte + 1) >> 0;
                }
                break Start;
            case 0xe0:
            case 0xe1:
            case 0xe2:
                data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                if (Da & 0x0080) CommandIndex = 0xffff;
                else CommandIndex = -1;
                Operand = (Registers[ECXIndex] - 1) & CommandIndex;
                Registers[ECXIndex] = (Registers[ECXIndex] & ~CommandIndex) | Operand;
                CurrentByteOfCodeSeg &= 3;
                if (CurrentByteOfCodeSeg == 0) Operand2 = !(ZeroFlag == 0);
                else if (CurrentByteOfCodeSeg == 1) Operand2 = (ZeroFlag == 0);
                else Operand2 = 1;
                if (Operand && Operand2) {
                    if (Da & 0x0100) {
                        EIPDword = (EIPDword + EIPDbyte - Mb + data) & 0xffff,
                        EIPDbyte = Mb = 0;
                    } else {
                        EIPDbyte = (EIPDbyte + data) >> 0;
                    }
                }
                break Start;
            case 0xe3:
                data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                if (Da & 0x0080) CommandIndex = 0xffff;
                else CommandIndex = -1;
                if ((Registers[ECXIndex] & CommandIndex) == 0) {
                    if (Da & 0x0100) {
                        EIPDword = (EIPDword + EIPDbyte - Mb + data) & 0xffff,
                        EIPDbyte = Mb = 0;
                    } else {
                        EIPDbyte = (EIPDbyte + data) >> 0;
                    }
                }
                break Start;
            case 0xc2:
                Operand = (Ob() << 16) >> 16;
                data = Ad();
                Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Registers[ESPIndex] + 4 + Operand) & Pa);
                EIPDword = data,
                EIPDbyte = Mb = 0;
                break Start;
            case 0xc3:
                if (Qa) {
                    v_addr = Registers[ESPIndex];
                    data = ReadIntFromVaddrReadOnly();
                    Registers[ESPIndex] = (Registers[ESPIndex] + 4) >> 0;
                } else {
                    data = Ad();
                    Bd();
                }
                EIPDword = data,
                EIPDbyte = Mb = 0;
                break Start;
            case 0xe8:
                {
                    data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                    EIPDbyte += 4;
                };
                Operand = (EIPDword + EIPDbyte - Mb);
                if (Qa) {
                    v_addr = (Registers[ESPIndex] - 4) >> 0;
                    WriteIntToVaddr(Operand);
                    Registers[ESPIndex] = v_addr;
                } else {
                    xd(Operand);
                }
                EIPDbyte = (EIPDbyte + data) >> 0;
                break Start;
            case 0x9a:
                Operand2 = (((Da >> 8) & 1) ^ 1);
                if (Operand2) {
                    {
                        data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    };
                } else {
                    data = Ob();
                }
                Operand = Ob();
                Ze(Operand2, Operand, data, (EIPDword + EIPDbyte - Mb)); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xca:
                Operand = (Ob() << 16) >> 16;
                nf((((Da >> 8) & 1) ^ 1), Operand); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xcb:
                nf((((Da >> 8) & 1) ^ 1), 0); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xcf:
                mf((((Da >> 8) & 1) ^ 1)); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0x90:
                break Start;
            case 0xcc:
                Operand = (EIPDword + EIPDbyte - Mb);
                Ae(3, 1, 0, Operand, 0);
                break Start;
            case 0xcd:
                data = alias_phys_mem8[EIPDbyte++];;
                if ((alias_CPU_X86.eflags & 0x00020000) && ((alias_CPU_X86.eflags >> 12) & 3) != 3) Interrupt(13);
                Operand = (EIPDword + EIPDbyte - Mb);
                Ae(data, 1, 0, Operand, 0);
                break Start;
            case 0xce:
                if (CheckOverFlow()) {
                    Operand = (EIPDword + EIPDbyte - Mb);
                    Ae(4, 1, 0, Operand, 0);
                }
                break Start;
            case 0x62:
                Hf();
                break Start;
            case 0xf5://cmc
                SRC = CalculateEFL() ^ 0x0001;
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
                break Start;
            case 0xf8://clc
                SRC = CalculateEFL() & ~0x0001;
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
                break Start;
            case 0xf9://stc
                SRC = CalculateEFL() | 0x0001;
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
                break Start;
            case 0xfc:
                alias_CPU_X86.df = 1;
                break Start;
            case 0xfd:
                alias_CPU_X86.df = -1;
                break Start;
            case 0xfa:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                alias_CPU_X86.eflags &= ~0x00000200;
                break Start;
            case 0xfb:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                alias_CPU_X86.eflags |= 0x00000200; {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0x9e: //store ah into flags
                SRC = ((Registers[EAXIndex] >> 8) & (0x0080 | 0x0040 | 0x0010 | 0x0004 | 0x0001)) | (CheckOverFlow() << 11);
                ZeroFlag = ((SRC >> 6) & 1) ^ 1;
                OP = 24;
                break Start;
            case 0x9f:
                data = id();
                UpdateAlOrAh(4, data);
                break Start;
            case 0xf4: //hlt
                if (alias_CPU_X86.cpl != 0) Interrupt(13);
                alias_CPU_X86.halted = 1;
                ErrorCode = 257;
                break Bg;
            case 0xa4:
                dg();
                break Start;
            case 0xa5:
                sg();
                break Start;
            case 0xaa:
                fg();
                break Start;
            case 0xab:
                xg();
                break Start;
            case 0xa6:
                gg();
                break Start;
            case 0xa7:
                yg();
                break Start;
            case 0xac:
                hg();
                break Start;
            case 0xad:
                zg();
                break Start;
            case 0xae:
                ig();
                break Start;
            case 0xaf:
                Ag();
                break Start;
            case 0x6c:
                Wf(); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0x6d:
                qg(); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0x6e:
                bg(); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0x6f:
                rg(); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xd8:
            case 0xd9:
            case 0xda:
            case 0xdb:
            case 0xdc:
            case 0xdd:
            case 0xde:
            case 0xdf:
                if (alias_CPU_X86.cr0 & ((1 << 2) | (1 << 3))) {
                    Interrupt(7);
                }
                ModRM = alias_phys_mem8[EIPDbyte++];;
                RegIndex = (ModRM >> 3) & 7;
                RMIndex = ModRM & 7;
                CommandIndex = ((CurrentByteOfCodeSeg & 7) << 3) | ((ModRM >> 3) & 7);
                UpdateAx(EAXIndex, 0xffff);
                if ((ModRM >> 6) == 3) {} else {
                    v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                }
                break Start;
            case 0x9b:
                break Start;
            case 0xe4:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                data = alias_phys_mem8[EIPDbyte++];;
                UpdateAlOrAh(0, alias_CPU_X86.ld8_port(data)); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xe5:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                data = alias_phys_mem8[EIPDbyte++];;
                Registers[EAXIndex] = alias_CPU_X86.ld32_port(data); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xe6:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                data = alias_phys_mem8[EIPDbyte++];;
                alias_CPU_X86.st8_port(data, Registers[EAXIndex] & 0xff); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xe7:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                data = alias_phys_mem8[EIPDbyte++];;
                alias_CPU_X86.st32_port(data, Registers[EAXIndex]); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xec:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                UpdateAlOrAh(0, alias_CPU_X86.ld8_port(Registers[EDXIndex] & 0xffff)); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xed:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                Registers[EAXIndex] = alias_CPU_X86.ld32_port(Registers[EDXIndex] & 0xffff); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xee:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                alias_CPU_X86.st8_port(Registers[EDXIndex] & 0xffff, Registers[EAXIndex] & 0xff); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0xef:
                Sa = (alias_CPU_X86.eflags >> 12) & 3;
                if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                alias_CPU_X86.st32_port(Registers[EDXIndex] & 0xffff, Registers[EAXIndex]); {
                    if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                };
                break Start;
            case 0x27:
                Df();
                break Start;
            case 0x2f:
                Ff();
                break Start;
            case 0x37:
                zf();
                break Start;
            case 0x3f:
                Cf();
                break Start;
            case 0xd4:
                data = alias_phys_mem8[EIPDbyte++];;
                vf(data);
                break Start;
            case 0xd5:
                data = alias_phys_mem8[EIPDbyte++];;
                yf(data);
                break Start;
            case 0x63:
                tf();
                break Start;
            case 0xd6:
            case 0xf1:
                Interrupt(6);
                break;
            case 0x0f:
                CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                switch (CurrentByteOfCodeSeg) {
                case 0x80:
                case 0x81:
                case 0x82:
                case 0x83:
                case 0x84:
                case 0x85:
                case 0x86:
                case 0x87:
                case 0x88:
                case 0x89:
                case 0x8a:
                case 0x8b:
                case 0x8c:
                case 0x8d:
                case 0x8e:
                case 0x8f:
                    {
                        data = alias_phys_mem8[EIPDbyte] | (alias_phys_mem8[EIPDbyte + 1] << 8) | (alias_phys_mem8[EIPDbyte + 2] << 16) | (alias_phys_mem8[EIPDbyte + 3] << 24);
                        EIPDbyte += 4;
                    };
                    if (fd(CurrentByteOfCodeSeg & 0xf)) EIPDbyte = (EIPDbyte + data) >> 0;
                    break Start;
                case 0x90:
                case 0x91:
                case 0x92:
                case 0x93:
                case 0x94:
                case 0x95:
                case 0x96:
                case 0x97:
                case 0x98:
                case 0x99:
                case 0x9a:
                case 0x9b:
                case 0x9c:
                case 0x9d:
                case 0x9e:
                case 0x9f:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    data = fd(CurrentByteOfCodeSeg & 0xf);
                    if ((ModRM >> 6) == 3) {
                        UpdateAlOrAh(ModRM & 7, data);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        WriteByteToVaddr(data);
                    }
                    break Start;
                case 0x40:
                case 0x41:
                case 0x42:
                case 0x43:
                case 0x44:
                case 0x45:
                case 0x46:
                case 0x47:
                case 0x48:
                case 0x49:
                case 0x4a:
                case 0x4b:
                case 0x4c:
                case 0x4d:
                case 0x4e:
                case 0x4f:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadOnly();
                    }
                    if (fd(CurrentByteOfCodeSeg & 0xf)) Registers[(ModRM >> 3) & 7] = data;
                    break Start;
                case 0xb6:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)) & 0xff;
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    }
                    Registers[RegIndex] = data;
                    break Start;
                case 0xb7:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7] & 0xffff;
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadOnly();
                    }
                    Registers[RegIndex] = data;
                    break Start;
                case 0xbe:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = (((value = alias_tlb_read[v_addr >>> 12]) == -1) ? LoadByteFromMissingVaddrReadOnly() : alias_phys_mem8[v_addr ^ value]);
                    }
                    Registers[RegIndex] = (((data) << 24) >> 24);
                    break Start;
                case 0xbf:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadOnly();
                    }
                    Registers[RegIndex] = (((data) << 16) >> 16);
                    break Start;
                case 0x00:
                    if (! (alias_CPU_X86.cr0 & (1 << 0)) || (alias_CPU_X86.eflags & 0x00020000)) Interrupt(6);
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    switch (CommandIndex) {
                    case 0:
                    case 1:
                        if (CommandIndex == 0) data = alias_CPU_X86.ldt.selector;
                        else data = alias_CPU_X86.tr.selector;
                        if ((ModRM >> 6) == 3) {
                            UpdateAx(ModRM & 7, data);
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            WriteShortToVaddr(data);
                        }
                        break;
                    case 2:
                    case 3:
                        if (alias_CPU_X86.cpl != 0) Interrupt(13);
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7] & 0xffff;
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        if (CommandIndex == 2) Ce(data);
                        else Ee(data);
                        break;
                    case 4:
                    case 5:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7] & 0xffff;
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        sf(data, CommandIndex & 1);
                        break;
                    default:
                        Interrupt(6);
                    }
                    break Start;
                case 0x01:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    switch (CommandIndex) {
                    case 2:
                    case 3:
                        if ((ModRM >> 6) == 3) Interrupt(6);
                        if (this.cpl != 0) Interrupt(13);
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadOnly();
                        v_addr += 2;
                        Operand = ReadIntFromVaddrReadOnly();
                        if (CommandIndex == 2) {
                            this.gdt.base = Operand;
                            this.gdt.limit = data;
                        } else {
                            this.idt.base = Operand;
                            this.idt.limit = data;
                        }
                        break;
                    case 7:
                        if (this.cpl != 0) Interrupt(13);
                        if ((ModRM >> 6) == 3) Interrupt(6);
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        alias_CPU_X86.tlb_flush_page(v_addr & -4096);
                        break;
                    default:
                        Interrupt(6);
                    }
                    break Start;
                case 0x02:
                case 0x03:
                    qf((((Da >> 8) & 1) ^ 1), CurrentByteOfCodeSeg & 1);
                    break Start;
                case 0x20:
                    if (alias_CPU_X86.cpl != 0) Interrupt(13);
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) != 3) Interrupt(6);
                    RegIndex = (ModRM >> 3) & 7;
                    switch (RegIndex) {
                    case 0:
                        data = alias_CPU_X86.cr0;
                        break;
                    case 2:
                        data = alias_CPU_X86.cr2;
                        break;
                    case 3:
                        data = alias_CPU_X86.cr3;
                        break;
                    case 4:
                        data = alias_CPU_X86.cr4;
                        break;
                    default:
                        Interrupt(6);
                    }
                    Registers[ModRM & 7] = data;
                    break Start;
                case 0x22:
                    if (alias_CPU_X86.cpl != 0) Interrupt(13);
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) != 3) Interrupt(6);
                    RegIndex = (ModRM >> 3) & 7;
                    data = Registers[ModRM & 7];
                    switch (RegIndex) {
                    case 0:
                        Pd(data);
                        break;
                    case 2:
                        alias_CPU_X86.cr2 = data;
                        break;
                    case 3:
                        Rd(data);
                        break;
                    case 4:
                        Td(data);
                        break;
                    default:
                        Interrupt(6);
                    }
                    break Start;
                case 0x06:
                    if (alias_CPU_X86.cpl != 0) Interrupt(13);
                    Pd(alias_CPU_X86.cr0 & ~ (1 << 3));
                    break Start;
                case 0x23:
                    if (alias_CPU_X86.cpl != 0) Interrupt(13);
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) != 3) Interrupt(6);
                    RegIndex = (ModRM >> 3) & 7;
                    data = Registers[ModRM & 7];
                    if (RegIndex == 4 || RegIndex == 5) Interrupt(6);
                    break Start;
                case 0xb2:
                case 0xb4:
                case 0xb5:
                    LoadSelectorFromFarPointer48IntoSegRegister(CurrentByteOfCodeSeg & 7);
                    break Start;
                case 0xa2:
                    uf();
                    break Start;
                case 0xa4:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    Operand = Registers[(ModRM >> 3) & 7];
                    if ((ModRM >> 6) == 3) {
                        Operand2 = alias_phys_mem8[EIPDbyte++];;
                        RMIndex = ModRM & 7;
                        Registers[RMIndex] = rc(Registers[RMIndex], Operand, Operand2);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand2 = alias_phys_mem8[EIPDbyte++];;
                        data = ReadIntFromVaddrReadWrite();
                        data = rc(data, Operand, Operand2);
                        WriteIntToVaddr(data);
                    }
                    break Start;
                case 0xa5:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    Operand = Registers[(ModRM >> 3) & 7];
                    Operand2 = Registers[ECXIndex];
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Registers[RMIndex] = rc(Registers[RMIndex], Operand, Operand2);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite();
                        data = rc(data, Operand, Operand2);
                        WriteIntToVaddr(data);
                    }
                    break Start;
                case 0xac:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    Operand = Registers[(ModRM >> 3) & 7];
                    if ((ModRM >> 6) == 3) {
                        Operand2 = alias_phys_mem8[EIPDbyte++];;
                        RMIndex = ModRM & 7;
                        Registers[RMIndex] = sc(Registers[RMIndex], Operand, Operand2);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand2 = alias_phys_mem8[EIPDbyte++];;
                        data = ReadIntFromVaddrReadWrite();
                        data = sc(data, Operand, Operand2);
                        WriteIntToVaddr(data);
                    }
                    break Start;
                case 0xad:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    Operand = Registers[(ModRM >> 3) & 7];
                    Operand2 = Registers[ECXIndex];
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Registers[RMIndex] = sc(Registers[RMIndex], Operand, Operand2);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite();
                        data = sc(data, Operand, Operand2);
                        WriteIntToVaddr(data);
                    }
                    break Start;
                case 0xba:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    switch (CommandIndex) {
                    case 4:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                            Operand = alias_phys_mem8[EIPDbyte++];;
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            Operand = alias_phys_mem8[EIPDbyte++];;
                            data = ReadIntFromVaddrReadOnly();
                        }
                        uc(data, Operand);
                        break;
                    case 5:
                    case 6:
                    case 7:
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            Operand = alias_phys_mem8[EIPDbyte++];;
                            Registers[RMIndex] = xc(CommandIndex & 3, Registers[RMIndex], Operand);
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            Operand = alias_phys_mem8[EIPDbyte++];;
                            data = ReadIntFromVaddrReadWrite();
                            data = xc(CommandIndex & 3, data, Operand);
                            WriteIntToVaddr(data);
                        }
                        break;
                    default:
                        Interrupt(6);
                    }
                    break Start;
                case 0xa3:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    Operand = Registers[(ModRM >> 3) & 7];
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        v_addr = (v_addr + ((Operand >> 5) << 2)) >> 0;
                        data = ReadIntFromVaddrReadOnly();
                    }
                    uc(data, Operand);
                    break Start;
                case 0xab:
                case 0xb3:
                case 0xbb:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    Operand = Registers[(ModRM >> 3) & 7];
                    CommandIndex = (CurrentByteOfCodeSeg >> 3) & 3;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Registers[RMIndex] = xc(CommandIndex, Registers[RMIndex], Operand);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        v_addr = (v_addr + ((Operand >> 5) << 2)) >> 0;
                        data = ReadIntFromVaddrReadWrite();
                        data = xc(CommandIndex, data, Operand);
                        WriteIntToVaddr(data);
                    }
                    break Start;
                case 0xbc:
                case 0xbd:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        Operand = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = ReadIntFromVaddrReadOnly();
                    }
                    if (CurrentByteOfCodeSeg & 1) Registers[RegIndex] = Bc(Registers[RegIndex], Operand);
                    else Registers[RegIndex] = zc(Registers[RegIndex], Operand);
                    break Start;
                case 0xaf:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        Operand = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = ReadIntFromVaddrReadOnly();
                    }
                    Registers[RegIndex] = SignedMul(Registers[RegIndex], Operand);
                    break Start;
                case 0x31:
                    if ((alias_CPU_X86.cr4 & (1 << 2)) && alias_CPU_X86.cpl != 0) Interrupt(13);
                    data = md();
                    Registers[EAXIndex] = data >>> 0;
                    Registers[EDXIndex] = (data / 0x100000000) >>> 0;
                    break Start;
                case 0xc0:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                        Operand = GroupCommand(0, data, (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)));
                        UpdateAlOrAh(RegIndex, data);
                        UpdateAlOrAh(RMIndex, Operand);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadWrite();
                        Operand = GroupCommand(0, data, (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)));
                        WriteByteToVaddr(Operand);
                        UpdateAlOrAh(RegIndex, data);
                    }
                    break Start;
                case 0xc1:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = Registers[RMIndex];
                        Operand = GroupCommand2(0, data, Registers[RegIndex]);
                        Registers[RegIndex] = data;
                        Registers[RMIndex] = Operand;
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite();
                        Operand = GroupCommand2(0, data, Registers[RegIndex]);
                        WriteIntToVaddr(Operand);
                        Registers[RegIndex] = data;
                    }
                    break Start;
                case 0xb0:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                        Operand = GroupCommand(5, Registers[EAXIndex], data);
                        if (Operand == 0) {
                            UpdateAlOrAh(RMIndex, (Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)));
                        } else {
                            UpdateAlOrAh(0, data);
                        }
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadByteFromVaddrReadWrite();
                        Operand = GroupCommand(5, Registers[EAXIndex], data);
                        if (Operand == 0) {
                            WriteByteToVaddr((Registers[RegIndex & 3] >> ((RegIndex & 4) << 1)));
                        } else {
                            UpdateAlOrAh(0, data);
                        }
                    }
                    break Start;
                case 0xb1:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = Registers[RMIndex];
                        Operand = GroupCommand2(5, Registers[EAXIndex], data);
                        if (Operand == 0) {
                            Registers[RMIndex] = Registers[RegIndex];
                        } else {
                            Registers[EAXIndex] = data;
                        }
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadIntFromVaddrReadWrite();
                        Operand = GroupCommand2(5, Registers[EAXIndex], data);
                        if (Operand == 0) {
                            WriteIntToVaddr(Registers[RegIndex]);
                        } else {
                            Registers[EAXIndex] = data;
                        }
                    }
                    break Start;
                case 0xa0:
                case 0xa8:
                    xd(alias_CPU_X86.SegDescriptors[(CurrentByteOfCodeSeg >> 3) & 7].selector);
                    break Start;
                case 0xa1:
                case 0xa9:
                    LoadSelectorIntoSegRegister((CurrentByteOfCodeSeg >> 3) & 7, Ad() & 0xffff);
                    Bd();
                    break Start;
                case 0xc8:
                case 0xc9:
                case 0xca:
                case 0xcb:
                case 0xcc:
                case 0xcd:
                case 0xce:
                case 0xcf:
                    RegIndex = CurrentByteOfCodeSeg & 7;
                    data = Registers[RegIndex];
                    data = (data >>> 24) | ((data >> 8) & 0x0000ff00) | ((data << 8) & 0x00ff0000) | (data << 24);
                    Registers[RegIndex] = data;
                    break Start;
                case 0x04:
                case 0x05:
                case 0x07:
                case 0x08:
                case 0x09:
                case 0x0a:
                case 0x0b:
                case 0x0c:
                case 0x0d:
                case 0x0e:
                case 0x0f:
                case 0x10:
                case 0x11:
                case 0x12:
                case 0x13:
                case 0x14:
                case 0x15:
                case 0x16:
                case 0x17:
                case 0x18:
                case 0x19:
                case 0x1a:
                case 0x1b:
                case 0x1c:
                case 0x1d:
                case 0x1e:
                case 0x1f:
                case 0x21:
                case 0x24:
                case 0x25:
                case 0x26:
                case 0x27:
                case 0x28:
                case 0x29:
                case 0x2a:
                case 0x2b:
                case 0x2c:
                case 0x2d:
                case 0x2e:
                case 0x2f:
                case 0x30:
                case 0x32:
                case 0x33:
                case 0x34:
                case 0x35:
                case 0x36:
                case 0x37:
                case 0x38:
                case 0x39:
                case 0x3a:
                case 0x3b:
                case 0x3c:
                case 0x3d:
                case 0x3e:
                case 0x3f:
                case 0x50:
                case 0x51:
                case 0x52:
                case 0x53:
                case 0x54:
                case 0x55:
                case 0x56:
                case 0x57:
                case 0x58:
                case 0x59:
                case 0x5a:
                case 0x5b:
                case 0x5c:
                case 0x5d:
                case 0x5e:
                case 0x5f:
                case 0x60:
                case 0x61:
                case 0x62:
                case 0x63:
                case 0x64:
                case 0x65:
                case 0x66:
                case 0x67:
                case 0x68:
                case 0x69:
                case 0x6a:
                case 0x6b:
                case 0x6c:
                case 0x6d:
                case 0x6e:
                case 0x6f:
                case 0x70:
                case 0x71:
                case 0x72:
                case 0x73:
                case 0x74:
                case 0x75:
                case 0x76:
                case 0x77:
                case 0x78:
                case 0x79:
                case 0x7a:
                case 0x7b:
                case 0x7c:
                case 0x7d:
                case 0x7e:
                case 0x7f:
                case 0xa6:
                case 0xa7:
                case 0xaa:
                case 0xae:
                case 0xb8:
                case 0xb9:
                case 0xc2:
                case 0xc3:
                case 0xc4:
                case 0xc5:
                case 0xc6:
                case 0xc7:
                case 0xd0:
                case 0xd1:
                case 0xd2:
                case 0xd3:
                case 0xd4:
                case 0xd5:
                case 0xd6:
                case 0xd7:
                case 0xd8:
                case 0xd9:
                case 0xda:
                case 0xdb:
                case 0xdc:
                case 0xdd:
                case 0xde:
                case 0xdf:
                case 0xe0:
                case 0xe1:
                case 0xe2:
                case 0xe3:
                case 0xe4:
                case 0xe5:
                case 0xe6:
                case 0xe7:
                case 0xe8:
                case 0xe9:
                case 0xea:
                case 0xeb:
                case 0xec:
                case 0xed:
                case 0xee:
                case 0xef:
                case 0xf0:
                case 0xf1:
                case 0xf2:
                case 0xf3:
                case 0xf4:
                case 0xf5:
                case 0xf6:
                case 0xf7:
                case 0xf8:
                case 0xf9:
                case 0xfa:
                case 0xfb:
                case 0xfc:
                case 0xfd:
                case 0xfe:
                case 0xff:
                default:
                    Interrupt(6);
                }
                break;
            default:
                switch (CurrentByteOfCodeSeg) {
                case 0x189:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    data = Registers[(ModRM >> 3) & 7];
                    if ((ModRM >> 6) == 3) {
                        UpdateAx(ModRM & 7, data);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        WriteShortToVaddr(data);
                    }
                    break Start;
                case 0x18b:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadOnly();
                    }
                    UpdateAx((ModRM >> 3) & 7, data);
                    break Start;
                case 0x1b8:
                case 0x1b9:
                case 0x1ba:
                case 0x1bb:
                case 0x1bc:
                case 0x1bd:
                case 0x1be:
                case 0x1bf:
                    UpdateAx(CurrentByteOfCodeSeg & 7, Ob());
                    break Start;
                case 0x1a1:
                    v_addr = SegRegisterIndexnerateIndirectAddressWithMoffset();
                    data = ReadShortFromVaddrReadOnly();
                    UpdateAx(EAXIndex, data);
                    break Start;
                case 0x1a3:
                    v_addr = SegRegisterIndexnerateIndirectAddressWithMoffset();
                    WriteShortToVaddr(Registers[EAXIndex]);
                    break Start;
                case 0x1c7:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) == 3) {
                        data = Ob();
                        UpdateAx(ModRM & 7, data);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = Ob();
                        WriteShortToVaddr(data);
                    }
                    break Start;
                case 0x191:
                case 0x192:
                case 0x193:
                case 0x194:
                case 0x195:
                case 0x196:
                case 0x197:
                    RegIndex = CurrentByteOfCodeSeg & 7;
                    data = Registers[EAXIndex];
                    UpdateAx(EAXIndex, Registers[RegIndex]);
                    UpdateAx(RegIndex, data);
                    break Start;
                case 0x187:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        data = Registers[RMIndex];
                        UpdateAx(RMIndex, Registers[RegIndex]);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadWrite();
                        WriteShortToVaddr(Registers[RegIndex]);
                    }
                    UpdateAx(RegIndex, data);
                    break Start;
                case 0x1c4:
                    LoadSelectorFromFarPointer32IntoSegRegister(0);
                    break Start;
                case 0x1c5:
                    LoadSelectorFromFarPointer32IntoSegRegister(3);
                    break Start;
                case 0x101:
                case 0x109:
                case 0x111:
                case 0x119:
                case 0x121:
                case 0x129:
                case 0x131:
                case 0x139:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (CurrentByteOfCodeSeg >> 3) & 7;
                    Operand = Registers[(ModRM >> 3) & 7];
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        UpdateAx(RMIndex, dc(CommandIndex, Registers[RMIndex], Operand));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        if (CommandIndex != 7) {
                            data = ReadShortFromVaddrReadWrite();
                            data = dc(CommandIndex, data, Operand);
                            WriteShortToVaddr(data);
                        } else {
                            data = ReadShortFromVaddrReadOnly();
                            dc(7, data, Operand);
                        }
                    }
                    break Start;
                case 0x103:
                case 0x10b:
                case 0x113:
                case 0x11b:
                case 0x123:
                case 0x12b:
                case 0x133:
                case 0x13b:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (CurrentByteOfCodeSeg >> 3) & 7;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        Operand = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = ReadShortFromVaddrReadOnly();
                    }
                    UpdateAx(RegIndex, dc(CommandIndex, Registers[RegIndex], Operand));
                    break Start;
                case 0x105:
                case 0x10d:
                case 0x115:
                case 0x11d:
                case 0x125:
                case 0x12d:
                case 0x135:
                case 0x13d:
                    Operand = Ob();
                    CommandIndex = (CurrentByteOfCodeSeg >> 3) & 7;
                    UpdateAx(EAXIndex, dc(CommandIndex, Registers[EAXIndex], Operand));
                    break Start;
                case 0x181:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Operand = Ob();
                        Registers[RMIndex] = dc(CommandIndex, Registers[RMIndex], Operand);
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = Ob();
                        if (CommandIndex != 7) {
                            data = ReadShortFromVaddrReadWrite();
                            data = dc(CommandIndex, data, Operand);
                            WriteShortToVaddr(data);
                        } else {
                            data = ReadShortFromVaddrReadOnly();
                            dc(7, data, Operand);
                        }
                    }
                    break Start;
                case 0x183:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        Operand = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                        UpdateAx(RMIndex, dc(CommandIndex, Registers[RMIndex], Operand));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                        if (CommandIndex != 7) {
                            data = ReadShortFromVaddrReadWrite();
                            data = dc(CommandIndex, data, Operand);
                            WriteShortToVaddr(data);
                        } else {
                            data = ReadShortFromVaddrReadOnly();
                            dc(7, data, Operand);
                        }
                    }
                    break Start;
                case 0x140:
                case 0x141:
                case 0x142:
                case 0x143:
                case 0x144:
                case 0x145:
                case 0x146:
                case 0x147:
                    RegIndex = CurrentByteOfCodeSeg & 7;
                    UpdateAx(RegIndex, ec(Registers[RegIndex]));
                    break Start;
                case 0x148:
                case 0x149:
                case 0x14a:
                case 0x14b:
                case 0x14c:
                case 0x14d:
                case 0x14e:
                case 0x14f:
                    RegIndex = CurrentByteOfCodeSeg & 7;
                    UpdateAx(RegIndex, fc(Registers[RegIndex]));
                    break Start;
                case 0x16b:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        Operand = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = ReadShortFromVaddrReadOnly();
                    }
                    Operand2 = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    UpdateAx(RegIndex, Rc(Operand, Operand2));
                    break Start;
                case 0x169:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    RegIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        Operand = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = ReadShortFromVaddrReadOnly();
                    }
                    Operand2 = Ob();
                    UpdateAx(RegIndex, Rc(Operand, Operand2));
                    break Start;
                case 0x185:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) == 3) {
                        data = Registers[ModRM & 7];
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadOnly();
                    }
                    Operand = Registers[(ModRM >> 3) & 7]; {
                        ZeroFlag = (((data & Operand) << 16) >> 16);
                        OP = 13;
                    };
                    break Start;
                case 0x1a9:
                    Operand = Ob(); {
                        ZeroFlag = (((Registers[EAXIndex] & Operand) << 16) >> 16);
                        OP = 13;
                    };
                    break Start;
                case 0x1f7:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    switch (CommandIndex) {
                    case 0:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        Operand = Ob(); {
                            ZeroFlag = (((data & Operand) << 16) >> 16);
                            OP = 13;
                        };
                        break;
                    case 2:
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            UpdateAx(RMIndex, ~Registers[RMIndex]);
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadWrite();
                            data = ~data;
                            WriteShortToVaddr(data);
                        }
                        break;
                    case 3:
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            UpdateAx(RMIndex, dc(5, 0, Registers[RMIndex]));
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadWrite();
                            data = dc(5, 0, data);
                            WriteShortToVaddr(data);
                        }
                        break;
                    case 4:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        data = Qc(Registers[EAXIndex], data);
                        UpdateAx(EAXIndex, data);
                        UpdateAx(EDXIndex, data >> 16);
                        break;
                    case 5:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        data = Rc(Registers[EAXIndex], data);
                        UpdateAx(EAXIndex, data);
                        UpdateAx(EDXIndex, data >> 16);
                        break;
                    case 6:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        UnsignedIntDivide(data);
                        break;
                    case 7:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        SignedIntDivide(data);
                        break;
                    default:
                        Interrupt(6);
                    }
                    break Start;
                case 0x1c1:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        Operand = alias_phys_mem8[EIPDbyte++];;
                        RMIndex = ModRM & 7;
                        UpdateAx(RMIndex, mc(CommandIndex, Registers[RMIndex], Operand));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Operand = alias_phys_mem8[EIPDbyte++];;
                        data = ReadShortFromVaddrReadWrite();
                        data = mc(CommandIndex, data, Operand);
                        WriteShortToVaddr(data);
                    }
                    break Start;
                case 0x1d1:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        UpdateAx(RMIndex, mc(CommandIndex, Registers[RMIndex], 1));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadWrite();
                        data = mc(CommandIndex, data, 1);
                        WriteShortToVaddr(data);
                    }
                    break Start;
                case 0x1d3:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    Operand = Registers[ECXIndex] & 0xff;
                    if ((ModRM >> 6) == 3) {
                        RMIndex = ModRM & 7;
                        UpdateAx(RMIndex, mc(CommandIndex, Registers[RMIndex], Operand));
                    } else {
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadWrite();
                        data = mc(CommandIndex, data, Operand);
                        WriteShortToVaddr(data);
                    }
                    break Start;
                case 0x198:
                    UpdateAx(EAXIndex, (Registers[EAXIndex] << 24) >> 24);
                    break Start;
                case 0x199:
                    UpdateAx(EDXIndex, (Registers[EAXIndex] << 16) >> 31);
                    break Start;
                case 0x190:
                    break Start;
                case 0x150:
                case 0x151:
                case 0x152:
                case 0x153:
                case 0x154:
                case 0x155:
                case 0x156:
                case 0x157:
                    vd(Registers[CurrentByteOfCodeSeg & 7]);
                    break Start;
                case 0x158:
                case 0x159:
                case 0x15a:
                case 0x15b:
                case 0x15c:
                case 0x15d:
                case 0x15e:
                case 0x15f:
                    data = yd();
                    zd();
                    UpdateAx(CurrentByteOfCodeSeg & 7, data);
                    break Start;
                case 0x160:
                    Jf();
                    break Start;
                case 0x161:
                    Lf();
                    break Start;
                case 0x18f:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) == 3) {
                        data = yd();
                        zd();
                        UpdateAx(ModRM & 7, data);
                    } else {
                        data = yd();
                        Operand = Registers[ESPIndex];
                        zd();
                        Operand2 = Registers[ESPIndex];
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        Registers[ESPIndex] = Operand;
                        WriteShortToVaddr(data);
                        Registers[ESPIndex] = Operand2;
                    }
                    break Start;
                case 0x168:
                    data = Ob();
                    vd(data);
                    break Start;
                case 0x16a:
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    vd(data);
                    break Start;
                case 0x1c8:
                    Pf();
                    break Start;
                case 0x1c9:
                    Nf();
                    break Start;
                case 0x106:
                case 0x10e:
                case 0x116:
                case 0x11e:
                    vd(alias_CPU_X86.SegDescriptors[(CurrentByteOfCodeSeg >> 3) & 3].selector);
                    break Start;
                case 0x107:
                case 0x117:
                case 0x11f:
                    LoadSelectorIntoSegRegister((CurrentByteOfCodeSeg >> 3) & 3, yd());
                    zd();
                    break Start;
                case 0x18d:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    if ((ModRM >> 6) == 3) Interrupt(6);
                    Da = (Da & ~0x000f) | (6 + 1);
                    UpdateAx((ModRM >> 3) & 7, SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM));
                    break Start;
                case 0x1ff:
                    ModRM = alias_phys_mem8[EIPDbyte++];;
                    CommandIndex = (ModRM >> 3) & 7;
                    switch (CommandIndex) {
                    case 0:
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            UpdateAx(RMIndex, ec(Registers[RMIndex]));
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadWrite();
                            data = ec(data);
                            WriteShortToVaddr(data);
                        }
                        break;
                    case 1:
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            UpdateAx(RMIndex, fc(Registers[RMIndex]));
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadWrite();
                            data = fc(data);
                            WriteShortToVaddr(data);
                        }
                        break;
                    case 2:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7] & 0xffff;
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        vd((EIPDword + EIPDbyte - Mb));
                        EIPDword = data,
                        EIPDbyte = Mb = 0;
                        break;
                    case 4:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7] & 0xffff;
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        EIPDword = data,
                        EIPDbyte = Mb = 0;
                        break;
                    case 6:
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        vd(data);
                        break;
                    case 3:
                    case 5:
                        if ((ModRM >> 6) == 3) Interrupt(6);
                        v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                        data = ReadShortFromVaddrReadOnly();
                        v_addr = (v_addr + 2) >> 0;
                        Operand = ReadShortFromVaddrReadOnly();
                        if (CommandIndex == 3) Ze(0, Operand, data, (EIPDword + EIPDbyte - Mb));
                        else Oe(Operand, data);
                        break;
                    default:
                        Interrupt(6);
                    }
                    break Start;
                case 0x1eb:
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    EIPDword = (EIPDword + EIPDbyte - Mb + data) & 0xffff,
                    EIPDbyte = Mb = 0;
                    break Start;
                case 0x1e9:
                    data = Ob();
                    EIPDword = (EIPDword + EIPDbyte - Mb + data) & 0xffff,
                    EIPDbyte = Mb = 0;
                    break Start;
                case 0x170:
                case 0x171:
                case 0x172:
                case 0x173:
                case 0x174:
                case 0x175:
                case 0x176:
                case 0x177:
                case 0x178:
                case 0x179:
                case 0x17a:
                case 0x17b:
                case 0x17c:
                case 0x17d:
                case 0x17e:
                case 0x17f:
                    data = ((alias_phys_mem8[EIPDbyte++] << 24) >> 24);;
                    Operand = fd(CurrentByteOfCodeSeg & 0xf);
                    if (Operand) EIPDword = (EIPDword + EIPDbyte - Mb + data) & 0xffff,
                    EIPDbyte = Mb = 0;
                    break Start;
                case 0x1c2:
                    Operand = (Ob() << 16) >> 16;
                    data = yd();
                    Registers[ESPIndex] = (Registers[ESPIndex] & ~Pa) | ((Registers[ESPIndex] + 2 + Operand) & Pa);
                    EIPDword = data,
                    EIPDbyte = Mb = 0;
                    break Start;
                case 0x1c3:
                    data = yd();
                    zd();
                    EIPDword = data,
                    EIPDbyte = Mb = 0;
                    break Start;
                case 0x1e8:
                    data = Ob();
                    vd((EIPDword + EIPDbyte - Mb));
                    EIPDword = (EIPDword + EIPDbyte - Mb + data) & 0xffff,
                    EIPDbyte = Mb = 0;
                    break Start;
                case 0x162:
                    If();
                    break Start;
                case 0x1a5:
                    lg();
                    break Start;
                case 0x1a7:
                    ng();
                    break Start;
                case 0x1ad:
                    og();
                    break Start;
                case 0x1af:
                    pg();
                    break Start;
                case 0x1ab:
                    mg();
                    break Start;
                case 0x16d:
                    jg(); {
                        if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                    };
                    break Start;
                case 0x16f:
                    kg(); {
                        if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                    };
                    break Start;
                case 0x1e5:
                    Sa = (alias_CPU_X86.eflags >> 12) & 3;
                    if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                    data = alias_phys_mem8[EIPDbyte++];;
                    UpdateAx(EAXIndex, alias_CPU_X86.ld16_port(data)); {
                        if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                    };
                    break Start;
                case 0x1e7:
                    Sa = (alias_CPU_X86.eflags >> 12) & 3;
                    if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                    data = alias_phys_mem8[EIPDbyte++];;
                    alias_CPU_X86.st16_port(data, Registers[EAXIndex] & 0xffff); {
                        if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                    };
                    break Start;
                case 0x1ed:
                    Sa = (alias_CPU_X86.eflags >> 12) & 3;
                    if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                    UpdateAx(EAXIndex, alias_CPU_X86.ld16_port(Registers[EDXIndex] & 0xffff)); {
                        if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                    };
                    break Start;
                case 0x1ef:
                    Sa = (alias_CPU_X86.eflags >> 12) & 3;
                    if (alias_CPU_X86.cpl > Sa) Interrupt(13);
                    alias_CPU_X86.st16_port(Registers[EDXIndex] & 0xffff, Registers[EAXIndex] & 0xffff); {
                        if (alias_CPU_X86.hard_irq != 0 && (alias_CPU_X86.eflags & 0x00000200)) break Bg;
                    };
                    break Start;
                case 0x166:
                case 0x167:
                case 0x1f0:
                case 0x1f2:
                case 0x1f3:
                case 0x126:
                case 0x12e:
                case 0x136:
                case 0x13e:
                case 0x164:
                case 0x165:
                case 0x100:
                case 0x108:
                case 0x110:
                case 0x118:
                case 0x120:
                case 0x128:
                case 0x130:
                case 0x138:
                case 0x102:
                case 0x10a:
                case 0x112:
                case 0x11a:
                case 0x122:
                case 0x12a:
                case 0x132:
                case 0x13a:
                case 0x104:
                case 0x10c:
                case 0x114:
                case 0x11c:
                case 0x124:
                case 0x12c:
                case 0x134:
                case 0x13c:
                case 0x1a0:
                case 0x1a2:
                case 0x1d8:
                case 0x1d9:
                case 0x1da:
                case 0x1db:
                case 0x1dc:
                case 0x1dd:
                case 0x1de:
                case 0x1df:
                case 0x184:
                case 0x1a8:
                case 0x1f6:
                case 0x1c0:
                case 0x1d0:
                case 0x1d2:
                case 0x1fe:
                case 0x1cd:
                case 0x1ce:
                case 0x1f5:
                case 0x1f8:
                case 0x1f9:
                case 0x1fc:
                case 0x1fd:
                case 0x1fa:
                case 0x1fb:
                case 0x19e:
                case 0x19f:
                case 0x1f4:
                case 0x127:
                case 0x12f:
                case 0x137:
                case 0x13f:
                case 0x1d4:
                case 0x1d5:
                case 0x16c:
                case 0x16e:
                case 0x1a4:
                case 0x1a6:
                case 0x1aa:
                case 0x1ac:
                case 0x1ae:
                case 0x180:
                case 0x182:
                case 0x186:
                case 0x188:
                case 0x18a:
                case 0x18c:
                case 0x18e:
                case 0x19b:
                case 0x1b0:
                case 0x1b1:
                case 0x1b2:
                case 0x1b3:
                case 0x1b4:
                case 0x1b5:
                case 0x1b6:
                case 0x1b7:
                case 0x1c6:
                case 0x1cc:
                case 0x1d7:
                case 0x1e4:
                case 0x1e6:
                case 0x1ec:
                case 0x1ee:
                case 0x1cf:
                case 0x1ca:
                case 0x1cb:
                case 0x19a:
                case 0x19c:
                case 0x19d:
                case 0x1ea:
                case 0x1e0:
                case 0x1e1:
                case 0x1e2:
                case 0x1e3:
                    CurrentByteOfCodeSeg &= 0xff;
                    break;
                case 0x163:
                case 0x1d6:
                case 0x1f1:
                default:
                    Interrupt(6);
                case 0x10f:
                    CurrentByteOfCodeSeg = alias_phys_mem8[EIPDbyte++];;
                    CurrentByteOfCodeSeg |= 0x0100;
                    switch (CurrentByteOfCodeSeg) {
                    case 0x180:
                    case 0x181:
                    case 0x182:
                    case 0x183:
                    case 0x184:
                    case 0x185:
                    case 0x186:
                    case 0x187:
                    case 0x188:
                    case 0x189:
                    case 0x18a:
                    case 0x18b:
                    case 0x18c:
                    case 0x18d:
                    case 0x18e:
                    case 0x18f:
                        data = Ob();
                        if (fd(CurrentByteOfCodeSeg & 0xf)) EIPDword = (EIPDword + EIPDbyte - Mb + data) & 0xffff,
                        EIPDbyte = Mb = 0;
                        break Start;
                    case 0x140:
                    case 0x141:
                    case 0x142:
                    case 0x143:
                    case 0x144:
                    case 0x145:
                    case 0x146:
                    case 0x147:
                    case 0x148:
                    case 0x149:
                    case 0x14a:
                    case 0x14b:
                    case 0x14c:
                    case 0x14d:
                    case 0x14e:
                    case 0x14f:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadOnly();
                        }
                        if (fd(CurrentByteOfCodeSeg & 0xf)) UpdateAx((ModRM >> 3) & 7, data);
                        break Start;
                    case 0x1b6:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        RegIndex = (ModRM >> 3) & 7;
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1)) & 0xff;
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadByteFromVaddrReadOnly();
                        }
                        UpdateAx(RegIndex, data);
                        break Start;
                    case 0x1be:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        RegIndex = (ModRM >> 3) & 7;
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            data = (Registers[RMIndex & 3] >> ((RMIndex & 4) << 1));
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadByteFromVaddrReadOnly();
                        }
                        UpdateAx(RegIndex, (((data) << 24) >> 24));
                        break Start;
                    case 0x1af:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        RegIndex = (ModRM >> 3) & 7;
                        if ((ModRM >> 6) == 3) {
                            Operand = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            Operand = ReadShortFromVaddrReadOnly();
                        }
                        UpdateAx(RegIndex, Rc(Registers[RegIndex], Operand));
                        break Start;
                    case 0x1c1:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        RegIndex = (ModRM >> 3) & 7;
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            data = Registers[RMIndex];
                            Operand = dc(0, data, Registers[RegIndex]);
                            UpdateAx(RegIndex, data);
                            UpdateAx(RMIndex, Operand);
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadWrite();
                            Operand = dc(0, data, Registers[RegIndex]);
                            WriteShortToVaddr(Operand);
                            UpdateAx(RegIndex, data);
                        }
                        break Start;
                    case 0x1a0:
                    case 0x1a8:
                        vd(alias_CPU_X86.SegDescriptors[(CurrentByteOfCodeSeg >> 3) & 7].selector);
                        break Start;
                    case 0x1a1:
                    case 0x1a9:
                        LoadSelectorIntoSegRegister((CurrentByteOfCodeSeg >> 3) & 7, yd());
                        zd();
                        break Start;
                    case 0x1b2:
                    case 0x1b4:
                    case 0x1b5:
                        LoadSelectorFromFarPointer32IntoSegRegister(CurrentByteOfCodeSeg & 7);
                        break Start;
                    case 0x1a4:
                    case 0x1ac:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        Operand = Registers[(ModRM >> 3) & 7];
                        CommandIndex = (CurrentByteOfCodeSeg >> 3) & 1;
                        if ((ModRM >> 6) == 3) {
                            Operand2 = alias_phys_mem8[EIPDbyte++];;
                            RMIndex = ModRM & 7;
                            UpdateAx(RMIndex, oc(CommandIndex, Registers[RMIndex], Operand, Operand2));
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            Operand2 = alias_phys_mem8[EIPDbyte++];;
                            data = ReadShortFromVaddrReadWrite();
                            data = oc(CommandIndex, data, Operand, Operand2);
                            WriteShortToVaddr(data);
                        }
                        break Start;
                    case 0x1a5:
                    case 0x1ad:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        Operand = Registers[(ModRM >> 3) & 7];
                        Operand2 = Registers[ECXIndex];
                        CommandIndex = (CurrentByteOfCodeSeg >> 3) & 1;
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            UpdateAx(RMIndex, oc(CommandIndex, Registers[RMIndex], Operand, Operand2));
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadWrite();
                            data = oc(CommandIndex, data, Operand, Operand2);
                            WriteShortToVaddr(data);
                        }
                        break Start;
                    case 0x1ba:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        CommandIndex = (ModRM >> 3) & 7;
                        switch (CommandIndex) {
                        case 4:
                            if ((ModRM >> 6) == 3) {
                                data = Registers[ModRM & 7];
                                Operand = alias_phys_mem8[EIPDbyte++];;
                            } else {
                                v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                                Operand = alias_phys_mem8[EIPDbyte++];;
                                data = ReadShortFromVaddrReadOnly();
                            }
                            tc(data, Operand);
                            break;
                        case 5:
                        case 6:
                        case 7:
                            if ((ModRM >> 6) == 3) {
                                RMIndex = ModRM & 7;
                                Operand = alias_phys_mem8[EIPDbyte++];;
                                Registers[RMIndex] = vc(CommandIndex & 3, Registers[RMIndex], Operand);
                            } else {
                                v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                                Operand = alias_phys_mem8[EIPDbyte++];;
                                data = ReadShortFromVaddrReadWrite();
                                data = vc(CommandIndex & 3, data, Operand);
                                WriteShortToVaddr(data);
                            }
                            break;
                        default:
                            Interrupt(6);
                        }
                        break Start;
                    case 0x1a3:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        Operand = Registers[(ModRM >> 3) & 7];
                        if ((ModRM >> 6) == 3) {
                            data = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            v_addr = (v_addr + (((Operand & 0xffff) >> 4) << 1)) >> 0;
                            data = ReadShortFromVaddrReadOnly();
                        }
                        tc(data, Operand);
                        break Start;
                    case 0x1ab:
                    case 0x1b3:
                    case 0x1bb:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        Operand = Registers[(ModRM >> 3) & 7];
                        CommandIndex = (CurrentByteOfCodeSeg >> 3) & 3;
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            UpdateAx(RMIndex, vc(CommandIndex, Registers[RMIndex], Operand));
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            v_addr = (v_addr + (((Operand & 0xffff) >> 4) << 1)) >> 0;
                            data = ReadShortFromVaddrReadWrite();
                            data = vc(CommandIndex, data, Operand);
                            WriteShortToVaddr(data);
                        }
                        break Start;
                    case 0x1bc:
                    case 0x1bd:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        RegIndex = (ModRM >> 3) & 7;
                        if ((ModRM >> 6) == 3) {
                            Operand = Registers[ModRM & 7];
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            Operand = ReadShortFromVaddrReadOnly();
                        }
                        data = Registers[RegIndex];
                        if (CurrentByteOfCodeSeg & 1) data = Ac(data, Operand);
                        else data = yc(data, Operand);
                        UpdateAx(RegIndex, data);
                        break Start;
                    case 0x1b1:
                        ModRM = alias_phys_mem8[EIPDbyte++];;
                        RegIndex = (ModRM >> 3) & 7;
                        if ((ModRM >> 6) == 3) {
                            RMIndex = ModRM & 7;
                            data = Registers[RMIndex];
                            Operand = dc(5, Registers[EAXIndex], data);
                            if (Operand == 0) {
                                UpdateAx(RMIndex, Registers[RegIndex]);
                            } else {
                                UpdateAx(EAXIndex, data);
                            }
                        } else {
                            v_addr = SegRegisterIndexGenerateIndirectAddressWithModRM(ModRM);
                            data = ReadShortFromVaddrReadWrite();
                            Operand = dc(5, Registers[EAXIndex], data);
                            if (Operand == 0) {
                                WriteShortToVaddr(Registers[RegIndex]);
                            } else {
                                UpdateAx(EAXIndex, data);
                            }
                        }
                        break Start;
                    case 0x100:
                    case 0x101:
                    case 0x102:
                    case 0x103:
                    case 0x120:
                    case 0x122:
                    case 0x106:
                    case 0x123:
                    case 0x1a2:
                    case 0x131:
                    case 0x190:
                    case 0x191:
                    case 0x192:
                    case 0x193:
                    case 0x194:
                    case 0x195:
                    case 0x196:
                    case 0x197:
                    case 0x198:
                    case 0x199:
                    case 0x19a:
                    case 0x19b:
                    case 0x19c:
                    case 0x19d:
                    case 0x19e:
                    case 0x19f:
                    case 0x1b0:
                        CurrentByteOfCodeSeg = 0x0f;
                        EIPDbyte--;
                        break;
                    case 0x104:
                    case 0x105:
                    case 0x107:
                    case 0x108:
                    case 0x109:
                    case 0x10a:
                    case 0x10b:
                    case 0x10c:
                    case 0x10d:
                    case 0x10e:
                    case 0x10f:
                    case 0x110:
                    case 0x111:
                    case 0x112:
                    case 0x113:
                    case 0x114:
                    case 0x115:
                    case 0x116:
                    case 0x117:
                    case 0x118:
                    case 0x119:
                    case 0x11a:
                    case 0x11b:
                    case 0x11c:
                    case 0x11d:
                    case 0x11e:
                    case 0x11f:
                    case 0x121:
                    case 0x124:
                    case 0x125:
                    case 0x126:
                    case 0x127:
                    case 0x128:
                    case 0x129:
                    case 0x12a:
                    case 0x12b:
                    case 0x12c:
                    case 0x12d:
                    case 0x12e:
                    case 0x12f:
                    case 0x130:
                    case 0x132:
                    case 0x133:
                    case 0x134:
                    case 0x135:
                    case 0x136:
                    case 0x137:
                    case 0x138:
                    case 0x139:
                    case 0x13a:
                    case 0x13b:
                    case 0x13c:
                    case 0x13d:
                    case 0x13e:
                    case 0x13f:
                    case 0x150:
                    case 0x151:
                    case 0x152:
                    case 0x153:
                    case 0x154:
                    case 0x155:
                    case 0x156:
                    case 0x157:
                    case 0x158:
                    case 0x159:
                    case 0x15a:
                    case 0x15b:
                    case 0x15c:
                    case 0x15d:
                    case 0x15e:
                    case 0x15f:
                    case 0x160:
                    case 0x161:
                    case 0x162:
                    case 0x163:
                    case 0x164:
                    case 0x165:
                    case 0x166:
                    case 0x167:
                    case 0x168:
                    case 0x169:
                    case 0x16a:
                    case 0x16b:
                    case 0x16c:
                    case 0x16d:
                    case 0x16e:
                    case 0x16f:
                    case 0x170:
                    case 0x171:
                    case 0x172:
                    case 0x173:
                    case 0x174:
                    case 0x175:
                    case 0x176:
                    case 0x177:
                    case 0x178:
                    case 0x179:
                    case 0x17a:
                    case 0x17b:
                    case 0x17c:
                    case 0x17d:
                    case 0x17e:
                    case 0x17f:
                    case 0x1a6:
                    case 0x1a7:
                    case 0x1aa:
                    case 0x1ae:
                    case 0x1b7:
                    case 0x1b8:
                    case 0x1b9:
                    case 0x1bf:
                    case 0x1c0:
                    default:
                        Interrupt(6);
                    }
                    break;
                }
            }
        }
    } while (-- Ka );
    this.cycle_count += (ua - Ka);
    this.eip = (EIPDword + EIPDbyte - Mb);
    this.cc_src = SRC;
    this.cc_dst = ZeroFlag;
    this.cc_op = OP;
    this.cc_op2 = OP2;
    this.cc_dst2 = DST2;
    return ErrorCode;
};
CPU_X86.prototype.exec = function(ua) {
    var Dg, ErrorCode, Eg, va;
    Eg = this.cycle_count + ua;
    ErrorCode = 256;
    va = null;
    while (this.cycle_count < Eg) {
        try {
            ErrorCode = this.exec_internal(Eg - this.cycle_count, va);
            if (ErrorCode != 256) break;
            va = null;
        } catch(Fg) {
            if (Fg.hasOwnProperty("intno")) {
                va = Fg;
            } else {
                throw Fg;
            }
        }
    }
    return ErrorCode;
};
CPU_X86.prototype.load_binary = function(Gg, v_addr) {
    var Hg, Ig, tg, i, Jg, Kg;
    Hg = new XMLHttpRequest();
    Hg.open('GET', Gg, false);
    Kg = ('ArrayBuffer' in window && 'Uint8Array' in window);
/*  if (Kg && 'mozResponseType' in Hg) {
        Hg.mozResponseType = 'arraybuffer';
    } else if (Kg && 'responseType' in Hg) {
        Hg.responseType = 'arraybuffer';
    } else {*/
		//get the binary data, above two options didn't work.
        Hg.overrideMimeType('text/plain; charset=x-user-defined');
        Kg = false;
//  }
    Hg.send(null);
    if (Hg.status != 200 && Hg.status != 0) {
        throw "Error while loading " + Gg;
    }
    if (Kg && 'mozResponse' in Hg) {
        Ig = Hg.mozResponse;
    } else if (Kg && Hg.mozResponseArrayBuffer) {
        Ig = Hg.mozResponseArrayBuffer;
    } else if ('responseType' in Hg) {
        Ig = Hg.response;
    } else {
        Ig = Hg.responseText;
        Kg = false;
    }
    if (Kg) {
        tg = Ig.byteLength;
		console.log("Ig.byteLength = ", Ig.byteLength);
        Jg = new Uint8Array(Ig, 0, tg);
        for (i = 0; i < tg; i++) {
            this.st8_phys(v_addr + i, Jg[i]);
        }
    } else {
        tg = Ig.length;
        for (i = 0; i < tg; i++) {
            this.st8_phys(v_addr + i, Ig.charCodeAt(i));
        }
    }
    return tg;
};
function Lg(Operand) {
    return ((Operand / 10) << 4) | (Operand % 10);
}
function Mg(gj_ioport_manager) {
    var Og, d;
    Og = new Uint8Array(128);
    this.cmos_data = Og;
    this.cmos_index = 0;
    d = new Date();
    Og[0] = Lg(d.getUTCSeconds());
    Og[2] = Lg(d.getUTCMinutes());
    Og[4] = Lg(d.getUTCHours());
    Og[6] = Lg(d.getUTCDay());
    Og[7] = Lg(d.getUTCDate());
    Og[8] = Lg(d.getUTCMonth() + 1);
    Og[9] = Lg(d.getUTCFullYear() % 100);
    Og[10] = 0x26;
    Og[11] = 0x02;
    Og[12] = 0x00;
    Og[13] = 0x80;
    Og[0x14] = 0x02;
    gj_ioport_manager.register_ioport_write(0x70, 2, 1, this.ioport_write.bind(this));
    gj_ioport_manager.register_ioport_read(0x70, 2, 1, this.ioport_read.bind(this));
}
Mg.prototype.ioport_write = function(v_addr, Ig) {
    if (v_addr == 0x70) {
        this.cmos_index = Ig & 0x7f;
    }
};
Mg.prototype.ioport_read = function(v_addr) {
    var Pg;
    if (v_addr == 0x70) {
        return 0xff;
    } else {
        Pg = this.cmos_data[this.cmos_index];
        if (this.cmos_index == 10) this.cmos_data[10] ^= 0x80;
        else if (this.cmos_index == 12) this.cmos_data[12] = 0x00;
        return Pg;
    }
};
function Qg(gj_ioport_manager, Zf) {
    gj_ioport_manager.register_ioport_write(Zf, 2, 1, this.ioport_write.bind(this));
    gj_ioport_manager.register_ioport_read(Zf, 2, 1, this.ioport_read.bind(this));
    this.reset();
}
Qg.prototype.reset = function() {
    this.last_irr = 0;
    this.irr = 0;
    this.imr = 0;
    this.isr = 0;
    this.priority_add = 0;
    this.irq_base = 0;
    this.read_reg_select = 0;
    this.special_mask = 0;
    this.init_state = 0;
    this.auto_eoi = 0;
    this.rotate_on_autoeoi = 0;
    this.init4 = 0;
    this.elcr = 0;
    this.elcr_mask = 0;
};
Qg.prototype.set_irq1 = function(Rg, Qf) {
    var wc;
    wc = 1 << Rg;
    if (Qf) {
        if ((this.last_irr & wc) == 0) this.irr |= wc;
        this.last_irr |= wc;
    } else {
        this.last_irr &= ~wc;
    }
};
Qg.prototype.get_priority = function(wc) {
    var Sg;
    if (wc == 0) return - 1;
    Sg = 7;
    while ((wc & (1 << ((Sg + this.priority_add) & 7))) == 0) Sg--;
    return Sg;
};
Qg.prototype.get_irq = function() {
    var wc, Tg, Sg;
    wc = this.irr & ~this.imr;
    Sg = this.get_priority(wc);
    if (Sg < 0) return - 1;
    Tg = this.get_priority(this.isr);
    if (Sg > Tg) {
        return Sg;
    } else {
        return - 1;
    }
};
Qg.prototype.intack = function(Rg) {
    if (this.auto_eoi) {
        if (this.rotate_on_auto_eoi) this.priority_add = (Rg + 1) & 7;
    } else {
        this.isr |= (1 << Rg);
    }
    if (! (this.elcr & (1 << Rg))) this.irr &= ~ (1 << Rg);
};
Qg.prototype.ioport_write = function(v_addr, data) {
    var Sg;
    v_addr &= 1;
    if (v_addr == 0) {
        if (data & 0x10) {
            this.reset();
            this.init_state = 1;
            this.init4 = data & 1;
            if (data & 0x02) throw "single mode not supported";
            if (data & 0x08) throw "level sensitive irq not supported";
        } else if (data & 0x08) {
            if (data & 0x02) this.read_reg_select = data & 1;
            if (data & 0x40) this.special_mask = (data >> 5) & 1;
        } else {
            switch (data) {
            case 0x00:
            case 0x80:
                this.rotate_on_autoeoi = data >> 7;
                break;
            case 0x20:
            case 0xa0:
                Sg = this.get_priority(this.isr);
                if (Sg >= 0) {
                    this.isr &= ~ (1 << ((Sg + this.priority_add) & 7));
                }
                if (data == 0xa0) this.priority_add = (this.priority_add + 1) & 7;
                break;
            case 0x60:
            case 0x61:
            case 0x62:
            case 0x63:
            case 0x64:
            case 0x65:
            case 0x66:
            case 0x67:
                Sg = data & 7;
                this.isr &= ~ (1 << Sg);
                break;
            case 0xc0:
            case 0xc1:
            case 0xc2:
            case 0xc3:
            case 0xc4:
            case 0xc5:
            case 0xc6:
            case 0xc7:
                this.priority_add = (data + 1) & 7;
                break;
            case 0xe0:
            case 0xe1:
            case 0xe2:
            case 0xe3:
            case 0xe4:
            case 0xe5:
            case 0xe6:
            case 0xe7:
                Sg = data & 7;
                this.isr &= ~ (1 << Sg);
                this.priority_add = (Sg + 1) & 7;
                break;
            }
        }
    } else {
        switch (this.init_state) {
        case 0:
            this.imr = data;
            this.update_irq();
            break;
        case 1:
            this.irq_base = data & 0xf8;
            this.init_state = 2;
            break;
        case 2:
            if (this.init4) {
                this.init_state = 3;
            } else {
                this.init_state = 0;
            }
            break;
        case 3:
            this.auto_eoi = (data >> 1) & 1;
            this.init_state = 0;
            break;
        }
    }
};
Qg.prototype.ioport_read = function(Ug) {
    var v_addr, Pg;
    v_addr = Ug & 1;
    if (v_addr == 0) {
        if (this.read_reg_select) Pg = this.isr;
        else Pg = this.irr;
    } else {
        Pg = this.imr;
    }
    return Pg;
};
function Vg(gj_ioport_manager, Wg, Ug, Xg) {
    this.pics = new Array();
    this.pics[0] = new Qg(gj_ioport_manager, Wg);
    this.pics[1] = new Qg(gj_ioport_manager, Ug);
    this.pics[0].elcr_mask = 0xf8;
    this.pics[1].elcr_mask = 0xde;
    this.irq_requested = 0;
    this.cpu_set_irq = Xg;
    this.pics[0].update_irq = this.update_irq.bind(this);
    this.pics[1].update_irq = this.update_irq.bind(this);
}
Vg.prototype.update_irq = function() {
    var Yg, Rg;
    Yg = this.pics[1].get_irq();
    if (Yg >= 0) {
        this.pics[0].set_irq1(2, 1);
        this.pics[0].set_irq1(2, 0);
    }
    Rg = this.pics[0].get_irq();
    if (Rg >= 0) {
        this.cpu_set_irq(1);
    } else {
        this.cpu_set_irq(0);
    }
};
Vg.prototype.set_irq = function(Rg, Qf) {
    this.pics[Rg >> 3].set_irq1(Rg & 7, Qf);
    this.update_irq();
};
Vg.prototype.get_hard_intno = function() {
    var Rg, Yg, intno;
    Rg = this.pics[0].get_irq();
    if (Rg >= 0) {
        this.pics[0].intack(Rg);
        if (Rg == 2) {
            Yg = this.pics[1].get_irq();
            if (Yg >= 0) {
                this.pics[1].intack(Yg);
            } else {
                Yg = 7;
            }
            intno = this.pics[1].irq_base + Yg;
            Rg = Yg + 8;
        } else {
            intno = this.pics[0].irq_base + Rg;
        }
    } else {
        Rg = 7;
        intno = this.pics[0].irq_base + Rg;
    }
    this.update_irq();
    return intno;
};
function Zg(gj_ioport_manager, ah, bh) {
    var Signed, i;
    this.pit_channels = new Array();
    for (i = 0; i < 3; i++) {
        Signed = new ch(bh);
        this.pit_channels[i] = Signed;
        Signed.mode = 3;
        Signed.gate = (i != 2) >> 0;
        Signed.pit_load_count(0);
    }
    this.speaker_data_on = 0;
    this.set_irq = ah;
    gj_ioport_manager.register_ioport_write(0x40, 4, 1, this.ioport_write.bind(this));
    gj_ioport_manager.register_ioport_read(0x40, 3, 1, this.ioport_read.bind(this));
    gj_ioport_manager.register_ioport_read(0x61, 1, 1, this.speaker_ioport_read.bind(this));
    gj_ioport_manager.register_ioport_write(0x61, 1, 1, this.speaker_ioport_write.bind(this));
}
function ch(bh) {
    this.count = 0;
    this.latched_count = 0;
    this.rw_state = 0;
    this.mode = 0;
    this.bcd = 0;
    this.gate = 0;
    this.count_load_time = 0;
    this.get_ticks = bh;
    this.pit_time_unit = 1193182 / 2000000;
}
ch.prototype.get_time = function() {
    return Math.floor(this.get_ticks() * this.pit_time_unit);
};
ch.prototype.pit_get_count = function() {
    var d, dh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
    case 0:
    case 1:
    case 4:
    case 5:
        dh = (this.count - d) & 0xffff;
        break;
    default:
        dh = this.count - (d % this.count);
        break;
    }
    return dh;
};
ch.prototype.pit_get_out = function() {
    var d, eh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
    default:
    case 0:
        eh = (d >= this.count) >> 0;
        break;
    case 1:
        eh = (d < this.count) >> 0;
        break;
    case 2:
        if ((d % this.count) == 0 && d != 0) eh = 1;
        else eh = 0;
        break;
    case 3:
        eh = ((d % this.count) < (this.count >> 1)) >> 0;
        break;
    case 4:
    case 5:
        eh = (d == this.count) >> 0;
        break;
    }
    return eh;
};
ch.prototype.get_next_transition_time = function() {
    var d, fh, base, gh;
    d = this.get_time() - this.count_load_time;
    switch (this.mode) {
    default:
    case 0:
    case 1:
        if (d < this.count) fh = this.count;
        else return - 1;
        break;
    case 2:
        base = (d / this.count) * this.count;
        if ((d - base) == 0 && d != 0) fh = base + this.count;
        else fh = base + this.count + 1;
        break;
    case 3:
        base = (d / this.count) * this.count;
        gh = ((this.count + 1) >> 1);
        if ((d - base) < gh) fh = base + gh;
        else fh = base + this.count;
        break;
    case 4:
    case 5:
        if (d < this.count) fh = this.count;
        else if (d == this.count) fh = this.count + 1;
        else return - 1;
        break;
    }
    fh = this.count_load_time + fh;
    return fh;
};
ch.prototype.pit_load_count = function(data) {
    if (data == 0) data = 0x10000;
    this.count_load_time = this.get_time();
    this.count = data;
};
Zg.prototype.ioport_write = function(v_addr, data) {
    var hh, ih, Signed;
    v_addr &= 3;
    if (v_addr == 3) {
        hh = data >> 6;
        if (hh == 3) return;
        Signed = this.pit_channels[hh];
        ih = (data >> 4) & 3;
        switch (ih) {
        case 0:
            Signed.latched_count = Signed.pit_get_count();
            Signed.rw_state = 4;
            break;
        default:
            Signed.mode = (data >> 1) & 7;
            Signed.bcd = data & 1;
            Signed.rw_state = ih - 1 + 0;
            break;
        }
    } else {
        Signed = this.pit_channels[v_addr];
        switch (Signed.rw_state) {
        case 0:
            Signed.pit_load_count(data);
            break;
        case 1:
            Signed.pit_load_count(data << 8);
            break;
        case 2:
        case 3:
            if (Signed.rw_state & 1) {
                Signed.pit_load_count((Signed.latched_count & 0xff) | (data << 8));
            } else {
                Signed.latched_count = data;
            }
            Signed.rw_state ^= 1;
            break;
        }
    }
};
Zg.prototype.ioport_read = function(v_addr) {
    var Pg, ma, Signed;
    v_addr &= 3;
    Signed = this.pit_channels[v_addr];
    switch (Signed.rw_state) {
    case 0:
    case 1:
    case 2:
    case 3:
        ma = Signed.pit_get_count();
        if (Signed.rw_state & 1) Pg = (ma >> 8) & 0xff;
        else Pg = ma & 0xff;
        if (Signed.rw_state & 2) Signed.rw_state ^= 1;
        break;
    default:
    case 4:
    case 5:
        if (Signed.rw_state & 1) Pg = Signed.latched_count >> 8;
        else Pg = Signed.latched_count & 0xff;
        Signed.rw_state ^= 1;
        break;
    }
    return Pg;
};
Zg.prototype.speaker_ioport_write = function(v_addr, data) {
    this.speaker_data_on = (data >> 1) & 1;
    this.pit_channels[2].gate = data & 1;
};
Zg.prototype.speaker_ioport_read = function(v_addr) {
    var eh, Signed, data;
    Signed = this.pit_channels[2];
    eh = Signed.pit_get_out();
    data = (this.speaker_data_on << 1) | Signed.gate | (eh << 5);
    return data;
};
Zg.prototype.update_irq = function() {
    this.set_irq(1);
    this.set_irq(0);
};
function jh(gj_ioport_manager, v_addr, kh, lh) {
    this.divider = 0;
    this.rbr = 0;
    this.ier = 0;
    this.iir = 0x01;
    this.lcr = 0;
    this.mcr;
    this.lsr = 0x40 | 0x20;
    this.msr = 0;
    this.scr = 0;
    this.set_irq_func = kh;
    this.write_func = lh;
    this.receive_fifo = "";
    gj_ioport_manager.register_ioport_write(0x3f8, 8, 1, this.ioport_write.bind(this));
    gj_ioport_manager.register_ioport_read(0x3f8, 8, 1, this.ioport_read.bind(this));
}
jh.prototype.update_irq = function() {
    if ((this.lsr & 0x01) && (this.ier & 0x01)) {
        this.iir = 0x04;
    } else if ((this.lsr & 0x20) && (this.ier & 0x02)) {
        this.iir = 0x02;
    } else {
        this.iir = 0x01;
    }
    if (this.iir != 0x01) {
        this.set_irq_func(1);
    } else {
        this.set_irq_func(0);
    }
};
jh.prototype.ioport_write = function(v_addr, data) {
    v_addr &= 7;
    switch (v_addr) {
    default:
    case 0:
        if (this.lcr & 0x80) {
            this.divider = (this.divider & 0xff00) | data;
        } else {
            this.lsr &= ~0x20;
            this.update_irq();
            this.write_func(String.fromCharCode(data));
            this.lsr |= 0x20;
            this.lsr |= 0x40;
            this.update_irq();
        }
        break;
    case 1:
        if (this.lcr & 0x80) {
            this.divider = (this.divider & 0x00ff) | (data << 8);
        } else {
            this.ier = data;
            this.update_irq();
        }
        break;
    case 2:
        break;
    case 3:
        this.lcr = data;
        break;
    case 4:
        this.mcr = data;
        break;
    case 5:
        break;
    case 6:
        this.msr = data;
        break;
    case 7:
        this.scr = data;
        break;
    }
};
jh.prototype.ioport_read = function(v_addr) {
    var Pg;
    v_addr &= 7;
    switch (v_addr) {
    default:
    case 0:
        if (this.lcr & 0x80) {
            Pg = this.divider & 0xff;
        } else {
            Pg = this.rbr;
            this.lsr &= ~ (0x01 | 0x10);
            this.update_irq();
            this.send_char_from_fifo();
        }
        break;
    case 1:
        if (this.lcr & 0x80) {
            Pg = (this.divider >> 8) & 0xff;
        } else {
            Pg = this.ier;
        }
        break;
    case 2:
        Pg = this.iir;
        break;
    case 3:
        Pg = this.lcr;
        break;
    case 4:
        Pg = this.mcr;
        break;
    case 5:
        Pg = this.lsr;
        break;
    case 6:
        Pg = this.msr;
        break;
    case 7:
        Pg = this.scr;
        break;
    }
    return Pg;
};
jh.prototype.send_break = function() {
    this.rbr = 0;
    this.lsr |= 0x10 | 0x01;
    this.update_irq();
};
jh.prototype.send_char = function(mh) {
    this.rbr = mh;
    this.lsr |= 0x01;
    this.update_irq();
};
jh.prototype.send_char_from_fifo = function() {
    var nh;
    nh = this.receive_fifo;
    if (nh != "" && !(this.lsr & 0x01)) {
        this.send_char(nh.charCodeAt(0));
        this.receive_fifo = nh.substr(1, nh.length - 1);
    }
};
jh.prototype.send_chars = function(na) {
    this.receive_fifo += na;
    this.send_char_from_fifo();
};
function gj_keyboard(gj_ioport_manager, ph) {
    gj_ioport_manager.register_ioport_read(0x64, 1, 1, this.read_status.bind(this));
    gj_ioport_manager.register_ioport_write(0x64, 1, 1, this.write_command.bind(this));
    this.reset_request = ph;
}
gj_keyboard.prototype.read_status = function(v_addr) {
    return 0;
};
gj_keyboard.prototype.write_command = function(v_addr, data) {
    switch (data) {
    case 0xfe:
        this.reset_request();
        break;
    default:
        break;
    }
};
function gj_dataexchange(gj_ioport_manager, Zf, rh, lh, sh) {
    gj_ioport_manager.register_ioport_read(Zf, 16, 4, this.ioport_readl.bind(this));
    gj_ioport_manager.register_ioport_write(Zf, 16, 4, this.ioport_writel.bind(this));
    gj_ioport_manager.register_ioport_read(Zf + 8, 1, 1, this.ioport_readb.bind(this));
    gj_ioport_manager.register_ioport_write(Zf + 8, 1, 1, this.ioport_writeb.bind(this));
    this.cur_pos = 0;
    this.doc_str = "";
    this.read_func = rh;
    this.write_func = lh;
    this.get_boot_time = sh;
}
gj_dataexchange.prototype.ioport_writeb = function(v_addr, data) {
    this.doc_str += String.fromCharCode(data);
};
gj_dataexchange.prototype.ioport_readb = function(v_addr) {
    var c, na, data;
    na = this.doc_str;
    if (this.cur_pos < na.length) {
        data = na.charCodeAt(this.cur_pos) & 0xff;
    } else {
        data = 0;
    }
    this.cur_pos++;
    return data;
};
gj_dataexchange.prototype.ioport_writel = function(v_addr, data) {
    var na;
    v_addr = (v_addr >> 2) & 3;
    switch (v_addr) {
    case 0:
        this.doc_str = this.doc_str.substr(0, data >>> 0);
        break;
    case 1:
        return this.cur_pos = data >>> 0;
    case 2:
        na = String.fromCharCode(data & 0xff) + String.fromCharCode((data >> 8) & 0xff) + String.fromCharCode((data >> 16) & 0xff) + String.fromCharCode((data >> 24) & 0xff);
        this.doc_str += na;
        break;
    case 3:
        this.write_func(this.doc_str);
    }
};
gj_dataexchange.prototype.ioport_readl = function(v_addr) {
    var data;
    v_addr = (v_addr >> 2) & 3;
    switch (v_addr) {
    case 0:
        this.doc_str = this.read_func();
        return this.doc_str.length >> 0;
    case 1:
        return this.cur_pos >> 0;
    case 2:
        data = this.ioport_readb(0);
        data |= this.ioport_readb(0) << 8;
        data |= this.ioport_readb(0) << 16;
        data |= this.ioport_readb(0) << 24;
        return data;
    case 3:
        if (this.get_boot_time) return this.get_boot_time() >> 0;
        else return 0;
    }
};
function Xg(Qf) {
    this.hard_irq = Qf;
}
function th() {
    return this.cycle_count;
}
function PCEmulator(uh) {
    var alias_CPU_X86;
    alias_CPU_X86 = new CPU_X86();
    this.cpu = alias_CPU_X86;
    alias_CPU_X86.phys_mem_resize(uh.mem_size); //set physical memory size
    this.init_ioports();
    this.register_ioport_write(0x80, 1, 1, this.ioport80_write);
    this.pic = new Vg(this, 0x20, 0xa0, Xg.bind(alias_CPU_X86));
    this.pit = new Zg(this, this.pic.set_irq.bind(this.pic, 0), th.bind(alias_CPU_X86));
    this.cmos = new Mg(this);
    this.serial = new jh(this, 0x3f8, this.pic.set_irq.bind(this.pic, 4), uh.serial_write);
    this.kbd = new gj_keyboard(this, this.reset.bind(this));
    this.reset_request = 0;
    if (uh.clipboard_get && uh.clipboard_set) {
        this.jsclipboard = new gj_dataexchange(this, 0x3c0, uh.clipboard_get, uh.clipboard_set, uh.get_boot_time);
    }
    alias_CPU_X86.ld8_port = this.ld8_port.bind(this);
    alias_CPU_X86.ld16_port = this.ld16_port.bind(this);
    alias_CPU_X86.ld32_port = this.ld32_port.bind(this);
    alias_CPU_X86.st8_port = this.st8_port.bind(this);
    alias_CPU_X86.st16_port = this.st16_port.bind(this);
    alias_CPU_X86.st32_port = this.st32_port.bind(this);
    alias_CPU_X86.get_hard_intno = this.pic.get_hard_intno.bind(this.pic);
}
PCEmulator.prototype.load_binary = function(Gg, ha) {
    return this.cpu.load_binary(Gg, ha);
};
PCEmulator.prototype.start = function() {
    setTimeout(this.timer_func.bind(this), 10);
};
PCEmulator.prototype.timer_func = function() {
    var ErrorCode, vh, wh, xh, hltFlag, gj_ioport_manager, alias_CPU_X86;
    gj_ioport_manager = this;
    alias_CPU_X86 = gj_ioport_manager.cpu;
    wh = alias_CPU_X86.cycle_count + 100000;
    xh = false;
    hltFlag = false;
    zh: while (alias_CPU_X86.cycle_count < wh) {
        gj_ioport_manager.pit.update_irq();
        ErrorCode = alias_CPU_X86.exec(wh - alias_CPU_X86.cycle_count);
        if (ErrorCode == 256) {
            if (gj_ioport_manager.reset_request) {
                xh = true;
                break;
            }
        } else if (ErrorCode == 257) {//hlt
            hltFlag = true;
            break;
        } else {
            xh = true;
            break;
        }
    }
    if (!xh) {
        if (hltFlag) {
            setTimeout(this.timer_func.bind(this), 10);
        } else {
            setTimeout(this.timer_func.bind(this), 0);
        }
    }
};
PCEmulator.prototype.init_ioports = function() {
    var i, Ah, Bh;
    this.ioport_readb_table = new Array();
    this.ioport_writeb_table = new Array();
    this.ioport_readw_table = new Array();
    this.ioport_writew_table = new Array();
    this.ioport_readl_table = new Array();
    this.ioport_writel_table = new Array();
    Ah = this.default_ioport_readw.bind(this);
    Bh = this.default_ioport_writew.bind(this);
    for (i = 0; i < 1024; i++) {
        this.ioport_readb_table[i] = this.default_ioport_readb;
        this.ioport_writeb_table[i] = this.default_ioport_writeb;
        this.ioport_readw_table[i] = Ah;
        this.ioport_writew_table[i] = Bh;
        this.ioport_readl_table[i] = this.default_ioport_readl;
        this.ioport_writel_table[i] = this.default_ioport_writel;
    }
};
PCEmulator.prototype.default_ioport_readb = function(Zf) {
    var data;
    data = 0xff;
    return data;
};
PCEmulator.prototype.default_ioport_readw = function(Zf) {
    var data;
    data = this.ioport_readb_table[Zf](Zf);
    Zf = (Zf + 1) & (1024 - 1);
    data |= this.ioport_readb_table[Zf](Zf) << 8;
    return data;
};
PCEmulator.prototype.default_ioport_readl = function(Zf) {
    var data;
    data = -1;
    return data;
};
PCEmulator.prototype.default_ioport_writeb = function(Zf, data) {};
PCEmulator.prototype.default_ioport_writew = function(Zf, data) {
    this.ioport_writeb_table[Zf](Zf, data & 0xff);
    Zf = (Zf + 1) & (1024 - 1);
    this.ioport_writeb_table[Zf](Zf, (data >> 8) & 0xff);
};
PCEmulator.prototype.default_ioport_writel = function(Zf, data) {};
PCEmulator.prototype.ld8_port = function(Zf) {
    var data;
    data = this.ioport_readb_table[Zf & (1024 - 1)](Zf);
    return data;
};
PCEmulator.prototype.ld16_port = function(Zf) {
    var data;
    data = this.ioport_readw_table[Zf & (1024 - 1)](Zf);
    return data;
};
PCEmulator.prototype.ld32_port = function(Zf) {
    var data;
    data = this.ioport_readl_table[Zf & (1024 - 1)](Zf);
    return data;
};
PCEmulator.prototype.st8_port = function(Zf, data) {
    this.ioport_writeb_table[Zf & (1024 - 1)](Zf, data);
};
PCEmulator.prototype.st16_port = function(Zf, data) {
    this.ioport_writew_table[Zf & (1024 - 1)](Zf, data);
};
PCEmulator.prototype.st32_port = function(Zf, data) {
    this.ioport_writel_table[Zf & (1024 - 1)](Zf, data);
};
PCEmulator.prototype.register_ioport_read = function(start, tg, cc, Ch) {
    var i;
    switch (cc) {
    case 1:
        for (i = start; i < start + tg; i++) {
            this.ioport_readb_table[i] = Ch;
        }
        break;
    case 2:
        for (i = start; i < start + tg; i += 2) {
            this.ioport_readw_table[i] = Ch;
        }
        break;
    case 4:
        for (i = start; i < start + tg; i += 4) {
            this.ioport_readl_table[i] = Ch;
        }
        break;
    }
};
PCEmulator.prototype.register_ioport_write = function(start, tg, cc, Ch) {
    var i;
    switch (cc) {
    case 1:
        for (i = start; i < start + tg; i++) {
            this.ioport_writeb_table[i] = Ch;
        }
        break;
    case 2:
        for (i = start; i < start + tg; i += 2) {
            this.ioport_writew_table[i] = Ch;
        }
        break;
    case 4:
        for (i = start; i < start + tg; i += 4) {
            this.ioport_writel_table[i] = Ch;
        }
        break;
    }
};
PCEmulator.prototype.ioport80_write = function(v_addr, Ig) {};
PCEmulator.prototype.reset = function() {
    this.request_request = 1;
};
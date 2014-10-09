#ifndef _ARCH_I386_H_
#define _ARCH_I386_H_

#define		MEMORY_SIZE			(16*1024*1024)
#define		BIOS_BASE_ADDRESS	0x10000
#define		KERNEL_BASE_ADDRESS	0x00100000
#define		ROOTFS_BASE_ADDRESS	0x00400000
#define	EIP		0
#define	EAX		1
#define	ECX		2
#define	EDX		3
#define	EBX		4
#define	ESP		5
#define	EBP		6
#define	ESI		7
#define	EDI		8
#define	EFL		9
#define TOTAL_REGS	10
#define EFL_CF	0
#define EFL_PF	0x2
#define EFL_AF	0x10
#define EFL_ZF	0x40
#define EFL_SF	0x80
#define EFL_TF	0x100
#define EFL_IF	0x200
#define EFL_DF	0x400
#define EFL_OF	0x800
#define EFL_RF	0x10000

extern const unsigned char parity_table[256];
extern char phy_memory[MEMORY_SIZE];
extern int registers[TOTAL_REGS];
extern int restore_registers[TOTAL_REGS];
extern const char * registers_desc[TOTAL_REGS];

#define set_efl( flag ) (registers[EFL] = registers[EFL] | flag)
#define clr_efl( flag ) (registers[EFL] = registers[EFL] & (~flag))
#define set_efl_cc( condition, flag ) \
	if (condition) {\
		set_efl( flag );\
	} else {\
		clr_efl( flag );\
	}

#endif

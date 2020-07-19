#ifndef _ARCH_I386_H_
#define _ARCH_I386_H_

/*********************************************/
/*            Memory definition              */
/*********************************************/
#define		MEMORY_SIZE			(16*1024*1024)
#define		BIOS_BASE_ADDRESS	0x10000
#define		KERNEL_BASE_ADDRESS	0x00100000
#define		ROOTFS_BASE_ADDRESS	0x00400000

extern char phy_memory[MEMORY_SIZE];

/*********************************************/
/*            Register definition            */
/*********************************************/
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

typedef union _register_type_t {
	unsigned int u32;
	unsigned short u16;
	unsigned char u8[2];
} register_type;

void init_registers();
unsigned int get_register_value( unsigned int index );
void set_register_value( unsigned int index, unsigned int value );
const char * get_register_desc( unsigned int index );

/*********************************************/
/*         Status Register definition        */
/*********************************************/
extern const unsigned char parity_table[256];

#define EFL_CF 0
#define EFL_PF 0x2
#define EFL_AF 0x10
#define EFL_ZF 0x40
#define EFL_SF 0x80
#define EFL_TF 0x100
#define EFL_IF 0x200
#define EFL_DF 0x400
#define EFL_OF 0x800
#define EFL_RF 0x10000

#define set_efl( flag ) (set_register_value(EFL, get_register_value(EFL) | flag))
#define clr_efl( flag ) (set_register_value(EFL, get_register_value(EFL) & (~flag)))
#define set_efl_cc( condition, flag ) \
	if (condition) {\
		set_efl( flag );\
	} else {\
		clr_efl( flag );\
	}

/*********************************************/
/*      UnProgrammed Register definition     */
/*********************************************/

#define	ES		0
#define	CS		1
#define	SS		2
#define	DS		3
#define	FS		4
#define	GS		5
#define TOTAL_UNPROGRAMMED_REGS	6

typedef struct _segment_type_t {
	int selector;
	int base;
	int limit;
	int flags;
} segment_type;

void init_unprogrammed_registers();
segment_type * get_unprogrammed_register_value( unsigned int index );
void set_unprogrammed_register_value( unsigned int index, segment_type * value );
const char * get_unprogrammed_register_desc( unsigned int index );

extern int isProtectedMode();

#endif

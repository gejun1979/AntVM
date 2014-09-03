#ifndef _EMULATOR_I386_H_
#define _EMULATOR_I386_H_

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
#define TOTAL_REGS	9

int emulator_i386( const char * bios_path, const char * kernel_path, const char * rootfs_path );

#endif

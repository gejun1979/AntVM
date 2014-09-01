#ifndef _EMULATOR_I386_H_
#define _EMULATOR_I386_H_

#define		MEMORY_SIZE			(16*1024*1024)
#define		BIOS_BASE_ADDRESS	0x10000
#define		KERNEL_BASE_ADDRESS	0x00100000
#define		ROOTFS_BASE_ADDRESS	0x00400000

int emulator_i386( const char * bios_path, const char * kernel_path, const char * rootfs_path );

#endif

#include <stdlib.h>
#include <stdio.h>
#include "i386_library.h"
#include "interupt.h"
#include "instruction.h"
#include "i386.h"

unsigned char phy_memory[MEMORY_SIZE] = { 0 };
int registers[TOTAL_REGS] = { 0 };
int restore_registers[TOTAL_REGS] = { 0 }; //save registers for interupt mode

const char * registers_desc[TOTAL_REGS] = 
{
"eip",
"eax",
"ecx",
"edx",
"ebx",
"esp",
"ebp",
"esi",
"edi"
};

int emulator_i386( const char * bios_path, const char * kernel_path, const char * rootfs_path )
{
	int res = 0;

	res = load_image( bios_path, phy_memory, BIOS_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load bios %d\n", res );
		return -1;
	}

	res = load_image( kernel_path, phy_memory, KERNEL_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load kernel %d\n", res );
		return -1;
	}

	res = load_image( rootfs_path, phy_memory, ROOTFS_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load rootfs %d\n", res );
		return -1;
	}
	
	init_instruction_op();
	
	registers[EIP] = BIOS_BASE_ADDRESS;
	registers[EAX] = 0x01000000;
	registers[EBX] = 0x00200000;
	registers[ECX] = 0x0000F800;

	for (;;) {
		interupt_process();

		instruction_process();
	}

	return 0;
}

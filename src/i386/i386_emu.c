#include <stdlib.h>
#include <stdio.h>
#include <memory.h>
#include "i386_utility.h"
#include "i386_arch.h"
#include "interupt.h"
#include "instruction.h"

void reset()
{
	memset( registers, '\0', sizeof(registers) );

	registers[EIP] = BIOS_BASE_ADDRESS;
	registers[EAX] = 0x01000000;
	registers[EBX] = 0x00200000;
	registers[ECX] = 0x0000F800;
	registers[EFL] = 0x00000002;
}

void process_next_instruction()
{
	instruction_t ins;

	instruction_construct( &ins );
	instruction_decode( &ins );
	instruction_run( &ins );
	instruction_destruct( &ins );
}

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

	reset();

	while ( 1 ) {
		interupt_check();

		process_next_instruction();
	}

	return 0;
}

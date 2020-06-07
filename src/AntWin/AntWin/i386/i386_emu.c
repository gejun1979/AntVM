#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <memory.h>
#include "i386_utility.h"
#include "i386_arch.h"
#include "interupt.h"
#include "instruction.h"
#include "i386_port_action_map.h"
#include "devices/serial.h"

#ifdef _WIN32
#pragma warning (disable : 4996)
#endif

void reset()
{
    char * cmd_line = "console=ttyS0 root=/dev/ram0 rw init=/sbin/init notsc=1";

    init_registers();

    strcpy( phy_memory + get_register_value(ECX), cmd_line );

    init_port_action_map();

    init_serial();
}

void cleanup()
{
	uninit_serial();
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
		ant_log( error, "i386 emulater failed to load bios %d\n", res );
		return -1;
	}

	res = load_image( kernel_path, phy_memory, KERNEL_BASE_ADDRESS );
	if ( res ) {
		ant_log( error, "i386 emulater failed to load kernel %d\n", res );
		return -1;
	}

	res = load_image( rootfs_path, phy_memory, ROOTFS_BASE_ADDRESS );
	if ( res ) {
		ant_log( error, "i386 emulater failed to load rootfs %d\n", res );
		return -1;
	}

	reset();

	//only for debug purpose
	int instructionIndex = 0;
	int instructionStop = -1;

	while ( 1 ) {
		interupt_check();

		if (++instructionIndex == instructionStop) {
			getchar();
		}

		process_next_instruction();
	}
	
	cleanup();

	return 0;
}

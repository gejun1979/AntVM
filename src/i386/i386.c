#include <stdlib.h>
#include <stdio.h>
#include "tool.h"
#include "i386.h"

char g_memory[MEMORY_SIZE];

int emulator_i386( const char * bios_path, const char * kernel_path, const char * rootfs_path )
{
	int res = 0;

	res = load_image( bios_path, g_memory, BIOS_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load bios %d\n", res );
		return -1;
	}

	res = load_image( kernel_path, g_memory, KERNEL_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load kernel %d\n", res );
		return -1;
	}

	res = load_image( rootfs_path, g_memory, ROOTFS_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load rootfs %d\n", res );
		return -1;
	}

	return 0;
}

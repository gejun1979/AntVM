#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <linux/limits.h>
#include "i386/i386_arch.h"
#include "i386/i386_emu.h"

#define VERSION "0.0.1"

int g_debug_mode = 0;

void usage( const char * name )
{
	printf( "Usage: %s <-b bios> <-f rootfs> <-k linuxkernel> [-d]\n", name );
	printf( "-b		bios image\n");
	printf( "-f		rootfs image\n");
	printf( "-k		linux kernel image\n");
	printf( "-d		enable verbose log\n");
	printf( "-v		show version\n");
	printf( "-h		this help page\n");
}

void show_version()
{
	printf( "version:%s\n", VERSION );
}

int main( int argc, char * argv[] )
{
	int c;
	int res = 0;
	char bios_path[PATH_MAX] = {0};
	char rootfs_path[PATH_MAX] = {0};
	char kernel_path[PATH_MAX] = {0};

	while ( ( c = getopt( argc, argv, "b:f:k:vdh" ) ) != -1 ) {
		switch (c) {
		case 'b':
			strcpy( bios_path, optarg );
			break;
		case 'f':
			strcpy( rootfs_path, optarg );
			break;
		case 'k':
			strcpy( kernel_path, optarg );
			break;
		case 'v':
			show_version();
			return EXIT_SUCCESS;
		case 'h':
			usage( argv[0] );
			return EXIT_SUCCESS;
		case 'd':
			g_debug_mode = 1;
			break;
		default:
			usage( argv[0] );
			return EXIT_FAILURE;
		}
	}

	if ( optind < argc ) {
		printf("Error: unknown argument");
		for ( ; optind < argc; ++optind ) {
			printf( ", %s", argv[optind] );
		}
		printf("\n");
		usage( argv[0] );
		return EXIT_FAILURE;
	}

	if ( strlen( bios_path ) == 0 ) {
		printf( "Error: bios image path can't be empty.\n" );
		usage( argv[0] );
		return EXIT_FAILURE;
	}

	if ( strlen( rootfs_path ) == 0 ) {
		printf( "Error: rootfs image path can't be empty.\n" );
		usage( argv[0] );
		return EXIT_FAILURE;
	}

	if ( strlen( kernel_path ) == 0 ) {
		printf( "Error: linux kernel image path can't be empty.\n" );
		usage( argv[0] );
		return EXIT_FAILURE;
	}
	
	res = emulator_i386( bios_path, rootfs_path, kernel_path );
	if ( res ) {
		printf( "i386 emulater failed with %d\n", res );
		return EXIT_FAILURE;
	}

	return EXIT_SUCCESS;
}

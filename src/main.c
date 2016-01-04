#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <linux/limits.h>
#include "i386/i386_arch.h"
#include "i386/i386_emu.h"
#include "i386/i386_utility.h"

#define VERSION "0.0.2"

void usage( const char * name )
{
	fprintf( stdout, "Usage: %s <-b bios> <-f rootfs> <-k linuxkernel> [-l fileloglevel] [-s screenloglevel]\n", name );
	fprintf( stdout, "-b		bios image path\n");
	fprintf( stdout, "-f		rootfs image path\n");
	fprintf( stdout, "-k		linux kernel image path\n");
	fprintf( stdout, "-l		set an int value which is log level of log file\n");
 fprintf( stdout, "    1 - debug\n");
 fprintf( stdout, "    2 - log\n");
 fprintf( stdout, "    3 - warning\n");
 fprintf( stdout, "    4 - error\n");
	fprintf( stdout, "-s  set an int value which is log level of screen log\n");
 fprintf( stdout, "    1 - debug\n");
 fprintf( stdout, "    2 - log\n");
 fprintf( stdout, "    3 - warning\n");
 fprintf( stdout, "    4 - error\n");
	fprintf( stdout, "-v		show version\n");
	fprintf( stdout, "-h		this help page\n");
}

void show_version()
{
	fprintf( stdout, "version:%s\n", VERSION );
}

int main( int argc, char * argv[] )
{
	int c;
	int res = 0;
	char bios_path[PATH_MAX] = {0};
	char rootfs_path[PATH_MAX] = {0};
	char kernel_path[PATH_MAX] = {0};

	while ( ( c = getopt( argc, argv, "b:f:k:l:s:vdh" ) ) != -1 ) {
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
		case 'l':
			file_log_level = atoi( optarg );
			break;
  case 's':
			screen_log_level = atoi( optarg );
   break;
		default:
			usage( argv[0] );
			return EXIT_FAILURE;
		}
	}

	if ( optind < argc ) {
		fprintf(stderr, "Error: unknown argument");
		for ( ; optind < argc; ++optind ) {
			fprintf( stderr, ", %s", argv[optind] );
		}
		fprintf(stderr, "\n");
		usage( argv[0] );
		return EXIT_FAILURE;
	}

	if ( strlen( bios_path ) == 0 ) {
		fprintf( stderr, "Error: bios image path can't be empty.\n" );
		usage( argv[0] );
		return EXIT_FAILURE;
	}

	if ( strlen( rootfs_path ) == 0 ) {
		fprintf( stderr, "Error: rootfs image path can't be empty.\n" );
		usage( argv[0] );
		return EXIT_FAILURE;
	}

	if ( strlen( kernel_path ) == 0 ) {
		fprintf( stderr, "Error: linux kernel image path can't be empty.\n" );
		usage( argv[0] );
		return EXIT_FAILURE;
	}

	ant_log_init();
	
	res = emulator_i386( bios_path, rootfs_path, kernel_path );
	if ( res ) {
		fprintf( stderr, "i386 emulater failed with %d\n", res );
		return EXIT_FAILURE;
	}

	return EXIT_SUCCESS;
}

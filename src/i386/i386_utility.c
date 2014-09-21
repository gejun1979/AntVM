#include <stdlib.h>
#include <stdio.h>
#include "i386_utility.h"
#include "i386_arch.h"

void dump_instruction( int index, unsigned char * instruction, int len )
{
	int i = 0;

	printf( "instruction: %d\n", index );
	for ( ; i < len; ++i ) {
		printf( "0x%02x ", instruction[i] );
	}
	printf("\n");
}

void dump_registers()
{
	int i = 0;

	printf("register:\n");
	for ( ; i < TOTAL_REGS; ++i ) {
		printf( "%s = 0x%08x\n", registers_desc[i], registers[i] );
	}
	printf("\n");
}

int load_image( const char * image_path, char * p_memory, int image_address )
{
	FILE * p_file = fopen( image_path, "r" );
	if ( p_file ) {
		int size = 0;

		fseek( p_file, 0L, SEEK_END );
		size = ftell( p_file );
		fseek( p_file, 0L, SEEK_SET );

		if ( fread( (p_memory + image_address), 1, size, p_file ) != size ) {
			fclose( p_file );

			printf( "Failed to load image %s", image_path );
			exit( 1 );
		}

		fclose( p_file );
	} else {
		printf( "Failed to open image %s", image_path );
		exit( 1 );
	}

	return 0;
}

unsigned char fetch_char( unsigned char * p_memory, int pos )
{
	if ( pos >= MEMORY_SIZE ) {
		printf( "Fatal error, memory overflow\n" );
		exit( 1 );
	}

//	printf( "fetch_char: 0x%02x\n", p_memory[ pos ] );
	return p_memory[ pos ];
}

unsigned int fetch_int( unsigned char * p_memory, int pos )
{
	unsigned char value_octet[4] = { 0 };

	value_octet[0] = fetch_char( p_memory, pos++ );
	value_octet[1] = fetch_char( p_memory, pos++ );
	value_octet[2] = fetch_char( p_memory, pos++ );
	value_octet[3] = fetch_char( p_memory, pos++ );

	return *(unsigned int *) value_octet;
}
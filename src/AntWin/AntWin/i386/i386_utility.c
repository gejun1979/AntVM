#include <stdlib.h>
#include <stdio.h>
#include <sys/types.h>
#include <sys/stat.h>

#include "i386_utility.h"
#include "i386_arch.h"

#ifdef _WIN32
#pragma warning (disable : 4996)
#endif

log_level screen_log_level = log;
log_level file_log_level = debug;
FILE * log_fd = NULL;

void dump_instruction( int index, char * instruction, int len )
{
	int i = 0;

	ant_log( debug, "%d. ", index );
	for ( ; i < len; ++i ) {
		ant_log( debug, "0x%02x ", (unsigned char)instruction[i] );
	}
	ant_log(debug, "\n");
}

void dump_registers()
{
	ant_log(debug, "%s=%08X ", get_register_desc(EIP), get_register_value(EIP));
	ant_log(debug, "%s=%08X ", get_register_desc(EAX), get_register_value(EAX));
	ant_log(debug, "%s=%08X ", get_register_desc(ECX), get_register_value(ECX));
	ant_log(debug, "%s=%08X ", get_register_desc(EDX), get_register_value(EDX));
	ant_log(debug, "%s=%08X\n", get_register_desc(EBX), get_register_value(EBX));

	ant_log(debug, "%s=%08X ", get_register_desc(EFL), get_register_value(EFL));
	ant_log(debug, "%s=%08X ", get_register_desc(ESP), get_register_value(ESP));
	ant_log(debug, "%s=%08X ", get_register_desc(EBP), get_register_value(EBP));
	ant_log(debug, "%s=%08X ", get_register_desc(ESI), get_register_value(ESI));
	ant_log(debug, "%s=%08X\n", get_register_desc(EDI), get_register_value(EDI));

	segment_type * p_selector = NULL;
	p_selector = get_unprogrammed_register_value(ES);
	ant_log(debug, "%s=%08X %08X %08X %08X\n", get_unprogrammed_register_desc(ES), p_selector->base, p_selector->flags, p_selector->limit, p_selector->selector);

	p_selector = get_unprogrammed_register_value(CS);
	ant_log(debug, "%s=%08X %08X %08X %08X\n", get_unprogrammed_register_desc(CS), p_selector->base, p_selector->flags, p_selector->limit, p_selector->selector);

	p_selector = get_unprogrammed_register_value(SS);
	ant_log(debug, "%s=%08X %08X %08X %08X\n", get_unprogrammed_register_desc(SS), p_selector->base, p_selector->flags, p_selector->limit, p_selector->selector);

	p_selector = get_unprogrammed_register_value(DS);
	ant_log(debug, "%s=%08X %08X %08X %08X\n", get_unprogrammed_register_desc(DS), p_selector->base, p_selector->flags, p_selector->limit, p_selector->selector);

	p_selector = get_unprogrammed_register_value(FS);
	ant_log(debug, "%s=%08X %08X %08X %08X\n", get_unprogrammed_register_desc(FS), p_selector->base, p_selector->flags, p_selector->limit, p_selector->selector);

	p_selector = get_unprogrammed_register_value(GS);
	ant_log(debug, "%s=%08X %08X %08X %08X\n", get_unprogrammed_register_desc(GS), p_selector->base, p_selector->flags, p_selector->limit, p_selector->selector);
}

int load_image( const char * image_path, char * p_memory, int image_address )
{
	FILE * p_file = fopen( image_path, "rb" );
	if ( p_file ) {
		int size = 0;

		fseek( p_file, 0L, SEEK_END );
		size = ftell( p_file );
		fseek( p_file, 0L, SEEK_SET );

		size_t readBytes = fread((p_memory + image_address), 1, size, p_file);
		if ( readBytes != size ) {
			fclose( p_file );

			ant_log( error, "Failed to load image %s", image_path );
			return -1;
		}

		fclose( p_file );
	} else {
		ant_log( error, "Failed to open image %s", image_path );
		return -1;
	}

	return 0;
}

unsigned char fetch_char( char * p_memory, int pos )
{
	if ( pos >= MEMORY_SIZE ) {
		ant_log( error, "Fatal error, memory overflow\n" );
		exception_exit( 1 );
	}

	return p_memory[ pos ];
}

unsigned int fetch_int( char * p_memory, int pos )
{
	unsigned char value_octet[4] = { 0 };

	value_octet[0] = fetch_char( p_memory, pos++ );
	value_octet[1] = fetch_char( p_memory, pos++ );
	value_octet[2] = fetch_char( p_memory, pos++ );
	value_octet[3] = fetch_char( p_memory, pos++ );

	return *(unsigned int *) value_octet;
}

void ant_log_init()
{
	log_fd = fopen( "antlog.txt", "w+" );
}

void ant_log_uninit()
{
	fclose( log_fd );
}

void exception_exit(int ret)
{
	exit(ret);
}


#ifndef _I386_LIBRARY_H_
#define _I386_LIBRARY_H_

#include <stdio.h>
#include <stdlib.h>

int load_image( const char * image_path, char * p_memory, int image_address );

unsigned char fetch_char( char * p_memory, int pos );
unsigned int fetch_int( char * p_memory, int pos );

void dump_instruction( int index, char * instruction, int len );
void dump_registers();

typedef enum {
	error = 4,
	warning = 3,
	log = 2,
	debug = 1
} log_level;
extern log_level screen_log_level;
extern log_level file_log_level;

extern FILE * log_fd;

void ant_log_init();
void ant_log_uninit();
#define ant_log(level,...) \
 if ( level >= screen_log_level ) \
		fprintf( stdout, __VA_ARGS__ ); \
 if ( level >= file_log_level ) \
  fprintf( log_fd, __VA_ARGS__ );

#endif

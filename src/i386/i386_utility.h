#ifndef _I386_LIBRARY_H_
#define _I386_LIBRARY_H_

int load_image( const char * image_path, char * p_memory, int image_address );

unsigned char fetch_char( unsigned char * p_memory, int pos );
unsigned int fetch_int( unsigned char * p_memory, int pos );

void dump_instruction( int index, unsigned char * instruction, int len );
void dump_registers();

#endif

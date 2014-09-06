#ifndef _I386_LIBRARY_H_
#define _I386_LIBRARY_H_

// if success, then return 0; else return -1.
int load_image( const char * image_path, char * p_memory, int image_address );

// fetch character from memory
// if failed, then throw exception
unsigned char fetch_char( unsigned char * p_memory, int pos );

unsigned int fetch_int( unsigned char * p_memory, int pos );

void dump_instruction( unsigned char * instruction, int len );

void dump_registers();

void push( int value );

#define get_mod_from_modrm( _modrm ) ( _modrm >> 6 )
#define get_reg_from_modrm( _modrm ) ( ( _modrm & 0x3f ) >> 3 )
#define get_rm_from_modrm( _modrm ) ( _modrm & 0x07 )
#define is_modrm_regaddressing( _modrm ) ( 0x03 == get_mod_from_modrm( _modrm ) )

#endif

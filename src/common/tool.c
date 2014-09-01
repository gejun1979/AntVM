#include <stdlib.h>
#include <stdio.h>
#include "tool.h"

int load_image( const char * image_path, char * p_memory, int image_address )
{
    int size = 0;
	FILE * p_file = fopen( image_path, "r" );

    fseek( p_file, 0L, SEEK_END );
    size = ftell( p_file );

    fseek( p_file, 0L, SEEK_SET );
	fread( (p_memory + image_address), 1, size, p_file );

	fclose( p_file );
	return 0;
}

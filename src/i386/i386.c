#include <stdlib.h>
#include <stdio.h>
#include "tool.h"
#include "i386.h"

char memory[MEMORY_SIZE] = { 0 };
int registers[TOTAL_REGS] = { 0 };
int restore_registers[TOTAL_REGS] = { 0 }; //save registers for interupt mode

typedef int (*oper_code_func)( char * instruction, int * len );
oper_code_func op_array[256] = { 0 };

//if interupt is triggred, then return 1, else return 0.
int check_interupt()
{
	return 0;
}

int is_in_interupt_mode = 0;

//save general registers
void enter_interupt_mode()
{
	is_in_interupt_mode = 1;
}

//restore general registers
void exit_interupt_mode()
{
	is_in_interupt_mode = 0;
}

void interupt_process()
{
	if ( check_interupt() ) {
		if ( is_in_interupt_mode == 0 ) {
			enter_interupt_mode();
		}
	} else {
		if ( is_in_interupt_mode ) {
			exit_interupt_mode();
		}
	}
}

int emulator_i386( const char * bios_path, const char * kernel_path, const char * rootfs_path )
{
	int res = 0;

	res = load_image( bios_path, memory, BIOS_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load bios %d\n", res );
		return -1;
	}

	res = load_image( kernel_path, memory, KERNEL_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load kernel %d\n", res );
		return -1;
	}

	res = load_image( rootfs_path, memory, ROOTFS_BASE_ADDRESS );
	if ( res ) {
		printf( "i386 emulater failed to load rootfs %d\n", res );
		return -1;
	}
	
	registers[EIP] = BIOS_BASE_ADDRESS;

	for (;;) {
		int i = 0;
		int len = 0;
		char instruction_codes[15] = { 0 };
		oper_code_func instruction_action = NULL;

		interupt_process();

		//instruction process
		for ( ; i < 15; ++i ) {
			if ( (registers[EIP] + i) >= MEMORY_SIZE ) {
				//need to issue exception here.
				//error, memory overflow.
				printf( "Fatal error, memory overflow.\n" );
				exit( 1 );
			}

			instruction_codes[i] = memory[ registers[EIP] + i ];
			instruction_action = op_array[ instruction_codes[i] ];

			if ( instruction_action ) {
				if (instruction_action( instruction_codes, &len ) ) {
					//should trigger exception here
					printf( "Fatal error, invalid instruction.\n" );
					exit( 1 );
				}

				break;
			}

			if ( i == 14 ) {
				//should trigger exception here
				printf( "Fatal error, invalid instruction.\n" );
				exit( 1 );
			}
		}

		registers[EIP] += len;
	}

	return 0;
}

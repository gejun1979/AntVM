#include <stdlib.h>
#include <stdio.h>
#include "i386_library.h"
#include "instruction.h"
#include "i386.h"

typedef int (*oper_code_func)( unsigned char * instruction, int * len );

oper_code_func op_array[256] = { 0 };

int call_instruction( unsigned char * instruction, int * len )
{
	unsigned int value = fetch_int( phy_memory, registers[EIP] + *len );

	*(unsigned int *)(instruction + *len) = value;
	*len += 4;

	push( registers[EIP] );
	registers[EIP] += value;

	return 0;
}

int move_instruction( unsigned char * instruction, int * len )
{
	int res = 0;

	switch ( instruction[0] )
	{
	case 0x89:
		{
			unsigned char modrm = fetch_char( phy_memory, registers[EIP] + *len );

			*(instruction + *len) = modrm;
			*len += 1;

			if ( is_modrm_regaddressing( modrm ) ) {
				registers[ get_rm_from_modrm( modrm ) + 1 ] = registers[ get_reg_from_modrm( modrm ) + 1 ];
			} else {
				printf("Fatal error. Invalid instruction\n");
				exit( 1 );
			}

			break;
		}
	case 0xbc:
		{
			int value = fetch_int( phy_memory, registers[EIP] + *len );

			*(unsigned int *)(instruction + *len) = value;
			*len += 4;
			
			registers[ESP] = value;

			break;
		}
	default:
		res =  -1;
		break;
	}
	
	return res;
}

int push_instruction( unsigned char * instruction, int * len )
{
	int res = 0;

	switch ( instruction[0] )
	{
	case 0x50:
		push( registers[EAX] );
		break;
	case 0x51:
		push( registers[ECX] );
		break;
	case 0x53:
		push( registers[EBX] );
		break;
	case 0x55:
		push( registers[EBP] );
		break;
	case 0x56:
		push( registers[ESI] );
		break;
	default:
		res =  -1;
		break;
	}
	
	return res;
}

void init_instruction_op()
{
	op_array[0x50] = push_instruction;
	op_array[0x51] = push_instruction;
	op_array[0x53] = push_instruction;
	op_array[0x55] = push_instruction;
	op_array[0x56] = push_instruction;
	op_array[0x89] = move_instruction;
	op_array[0xbc] = move_instruction;
	op_array[0xe8] = call_instruction;
}

void instruction_process()
{
	int i = 0;
	int len = 0;
	unsigned char instruction_codes[15] = { 0 };
	oper_code_func instruction_action = NULL;

	//instruction process
	for ( ; i < 15; ++i ) {
		instruction_codes[i] = fetch_char( phy_memory, registers[EIP] + i );
		instruction_action = op_array[ instruction_codes[i] ];

		if ( instruction_action ) {
			len = i + 1;
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

	dump_instruction( instruction_codes, len );
	dump_registers();
}

#include <stdlib.h>
#include <stdio.h>
#include <memory.h>
#include "i386_utility.h"
#include "i386_arch.h"

const unsigned char parity_table[256] = {
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    0, 2, 2, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0, 2, 2, 0,
    2, 0, 0, 2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 0, 2,
};

char phy_memory[MEMORY_SIZE] = { 0 };
register_type registers[TOTAL_REGS];

void init_registers()
{
    memset( registers, '\0', sizeof(registers) );
    registers[EIP].u32 = BIOS_BASE_ADDRESS;
    registers[EAX].u32 = 0x01000000;
    registers[EBX].u32 = 0x00200000;
    registers[ECX].u32 = 0x0000F800;
    registers[EFL].u32 = 0x00000002;
}

unsigned int get_register_value( unsigned int index )
{
	if (index < TOTAL_REGS) {
		return registers[index].u32;
	}

	ant_log(error, "Unknown register %d in %s\n", index, __FUNCTION__ );
	exception_exit( 1 );
 
	return 0;
}

void set_register_value( unsigned int index, unsigned int value )
{
	if (index < TOTAL_REGS) {
		registers[index].u32 = value;
		return;
	}

	ant_log(error, "Unknown register %d in %s\n", index, __FUNCTION__ );
	exception_exit( 1 );
}

const char * registers_desc[TOTAL_REGS] =
{
"EIP", "EAX", "ECX", "EDX", "EBX", "ESP", "EBP", "ESI", "EDI", "EFL"
};

const char * get_register_desc( unsigned int index )
{
	if (index < TOTAL_REGS) {
		return registers_desc[index];
	}
	
	return "Unknown Reg";
}

/*********************************************/
/*      UnProgrammed Register definition     */
/*********************************************/

segment_type unprogrammed_registers[TOTAL_UNPROGRAMMED_REGS];

void init_unprogrammed_registers()
{
    memset( unprogrammed_registers, '\0', sizeof(unprogrammed_registers) );

	unprogrammed_registers[CS].flags = 1 << 22;
	unprogrammed_registers[SS].flags = 1 << 22;
}

segment_type * get_unprogrammed_register_value( unsigned int index )
{
	if (index < TOTAL_UNPROGRAMMED_REGS) {
		return &unprogrammed_registers[index];
	}

	ant_log(error, "Unknown register %d in %s\n", index, __FUNCTION__ );
	exception_exit( 1 );
 
	return NULL;
}

void set_unprogrammed_register_value( unsigned int index, segment_type * value )
{
	if (index < TOTAL_UNPROGRAMMED_REGS) {
		if (value) {
			unprogrammed_registers[index] = *value;
		}

		return;
	}

	ant_log(error, "Unknown register %d in %s\n", index, __FUNCTION__ );
	exception_exit( 1 );
}

const char * unprogrammed_registers_desc[TOTAL_UNPROGRAMMED_REGS] =
{
	"ES", "CS", "SS", "DS", "FS", "GS"
};

const char * get_unprogrammed_register_desc( unsigned int index )
{
	if (index < TOTAL_UNPROGRAMMED_REGS) {
		return unprogrammed_registers_desc[index];
	}
	
	return "Unknown Reg";
}

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
register_type restore_registers[TOTAL_REGS];

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
 switch (index)
 {
 case EIP:
  return registers[EIP].u32;
 case EAX:
  return registers[EAX].u32;
 case ECX:
  return registers[ECX].u32;
 case EDX:
  return registers[EDX].u32;
 case EBX:
  return registers[EBX].u32;
 case ESP:
  return registers[ESP].u32;
 case EBP:
  return registers[EBP].u32;
 case ESI:
  return registers[ESI].u32;
 case EDI:
  return registers[EDI].u32;
 case EFL:
  return registers[EFL].u32;
 default:
  ant_log(error, "Unknown register %d in %s\n", index, __FUNCTION__ );
  exit( 1 );
 }
 
 return 0;
}

void set_register_value( unsigned int index, unsigned int value )
{
	switch (index)
	{
	case EIP:
		registers[EIP].u32 = value;
		break;
 case EAX:
  registers[EAX].u32 = value;
  break;
 case ECX:
  registers[ECX].u32 = value;
  break;
 case EDX:
  registers[EDX].u32 = value;
  break;
 case EBX:
  registers[EBX].u32 = value;
  break;
 case ESP:
  registers[ESP].u32 = value;
  break;
 case EBP:
  registers[EBP].u32 = value;
  break;
 case ESI:
  registers[ESI].u32 = value;
  break;
 case EDI:
  registers[EDI].u32 = value;
  break;
 case EFL:
  registers[EFL].u32 = value;
  break;
 default:
  break;
 }
}

const char * registers_desc[TOTAL_REGS] =
{
"eip", "eax", "ecx", "edx", "ebx", "esp", "ebp", "esi", "edi", "efl"
};

const char * get_register_desc( unsigned int index )
{
	return registers_desc[index];
}


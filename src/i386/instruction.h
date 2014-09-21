#ifndef _EMULATOR_INSTRUCTION_H_
#define _EMULATOR_INSTRUCTION_H_

typedef struct {
	struct _private_instruction_t * priv;
} instruction_t;

void instruction_construct( instruction_t * p_inst );
void instruction_load( instruction_t * p_inst );
void instruction_run( instruction_t * p_inst );
void instruction_destruct( instruction_t * p_inst );

#endif

#include <stdlib.h>
#include <stdio.h>
#include "interupt.h"
#include "i386_arch.h"

int is_in_interupt_mode = 0;

int check_interupt_register()
{
	return 0;
}

void enter_interupt_mode()
{
	is_in_interupt_mode = 1;
}

void exit_interupt_mode()
{
	is_in_interupt_mode = 0;
}

void interupt_check()
{
	if ( check_interupt_register() ) {
		if ( is_in_interupt_mode == 0 ) {
			enter_interupt_mode();
		}
	} else {
		if ( is_in_interupt_mode ) {
			exit_interupt_mode();
		}
	}
}

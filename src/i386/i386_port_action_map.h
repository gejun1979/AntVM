#ifndef _EMULATOR_PORT_ACTION_MAP_H_
#define _EMULATOR_PORT_ACTION_MAP_H_

typedef int (*port_read_type)( int port );
typedef void (*port_write_type)( int port, int value );

void init_port_action_map();
int register_port_action( int port_low_bound, int port_high_bound, port_read_type read_action, port_write_type write_action );
int unregister_port_action( int port_low_bound, int port_high_bound );

int port_read( int port );
void port_write( int port, int value );

#endif

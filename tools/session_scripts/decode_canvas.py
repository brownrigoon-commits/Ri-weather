# -*- coding: utf-8 -*-
import base64, sys
sys.stdout.reconfigure(encoding="utf-8")
b64 = open(sys.argv[1]).read().split(",", 1)[1]
open(sys.argv[2], "wb").write(base64.b64decode(b64))
print("saved", sys.argv[2])

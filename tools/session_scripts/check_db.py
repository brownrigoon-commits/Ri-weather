# -*- coding: utf-8 -*-
import io, re
s = io.open(r'C:\Users\디자이너\Desktop\claude\Ri-weather\js\golfdb.js', encoding='utf-8').read()
names = re.findall(r'"n":"(.*?)"', s)
out = []
out.append('count=%d' % len(names))
out.append('ulsan=%s' % [n for n in names if '울산' in n])
out.append('sky=%s' % [n for n in names if '스카이' in n][:5])
out.append('lake=%s' % [n for n in names if '레이크' in n][:5])
out.append('broken=%d' % len([n for n in names if 'ì' in n or '�' in n]))
out.append('first=%s' % names[:8])
io.open(r'C:\Users\디자이너\AppData\Local\Temp\claude\C--Users------Desktop---AI\4560011b-9c43-4f94-9eec-f28d556e2d5a\scratchpad\check.txt', 'w', encoding='utf-8').write('\n'.join(out))
print('done')

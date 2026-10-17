// 裸の `npx mocha ...` 実行でもテストDB（NODE_ENV=test）に繋がるようにする。
// テスト中には全消去（destroy({where:{}})）を伴うテストがあり、
// NODE_ENV 未指定だと development（実DB）に繋いで実データを壊すため（教訓:
// knowledge/wiki/software-development/lessons-from-data-loss.md）。
// NODE_ENV が明示されていればそれを尊重する
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

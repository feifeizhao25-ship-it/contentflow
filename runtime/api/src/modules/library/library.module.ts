import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller';
import { LibraryJobService } from './library-job.service';
import { LibraryService } from './library.service';
import { LibraryStore } from './store';

/** 依赖 SystemModule 里的 ScheduleModule.forRoot()（全局）；PrismaService 来自全局 DatabaseModule。 */
@Module({
  controllers: [LibraryController],
  providers: [{ provide: LibraryStore, useFactory: () => new LibraryStore() }, LibraryService, LibraryJobService],
  exports: [LibraryService],
})
export class LibraryModule {}
